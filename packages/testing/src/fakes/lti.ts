import { createHmac, timingSafeEqual } from 'node:crypto';
import { err, ok, type LtiPlatform, type LtiPlatformId, type Result } from '@thp/domain';
import type { SchoolId, UserId } from '@thp/domain';
import type {
  LtiNonceRepository,
  LtiPlatformRepository,
  LtiTokenCheck,
  LtiTokenVerifier,
  LtiUserLinkRepository,
  PublicJwk,
  ToolKeyStore,
} from '@thp/ports';

export class InMemoryLtiPlatformRepository implements LtiPlatformRepository {
  private readonly rows = new Map<LtiPlatformId, LtiPlatform>();

  /** Whether a platform still exists (links to a removed one are forgotten). */
  has(id: LtiPlatformId): boolean {
    return this.rows.has(id);
  }

  save(platform: LtiPlatform): Promise<void> {
    this.rows.set(platform.id, platform);
    return Promise.resolve();
  }

  findById(schoolId: SchoolId, id: LtiPlatformId): Promise<LtiPlatform | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row?.schoolId === schoolId ? row : null);
  }

  findByIssuer(issuer: string, clientId: string | null): Promise<readonly LtiPlatform[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) => row.issuer === issuer && (clientId === null || row.clientId === clientId),
      ),
    );
  }

  listForSchool(schoolId: SchoolId): Promise<readonly LtiPlatform[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((row) => row.schoolId === schoolId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    );
  }

  delete(schoolId: SchoolId, id: LtiPlatformId): Promise<void> {
    if (this.rows.get(id)?.schoolId === schoolId) this.rows.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryLtiNonceRepository implements LtiNonceRepository {
  private readonly used = new Set<string>();

  claim(nonce: string): Promise<boolean> {
    if (this.used.has(nonce)) return Promise.resolve(false);
    this.used.add(nonce);
    return Promise.resolve(true);
  }
}

export class InMemoryLtiUserLinkRepository implements LtiUserLinkRepository {
  private readonly rows = new Map<string, { readonly userId: UserId; readonly linkedAt: Date }>();

  constructor(private readonly platforms: InMemoryLtiPlatformRepository) {}

  link(platformId: LtiPlatformId, subject: string, userId: UserId, linkedAt: Date): Promise<void> {
    this.rows.set(JSON.stringify([platformId, subject]), { userId, linkedAt });
    return Promise.resolve();
  }

  findUserId(platformId: LtiPlatformId, subject: string): Promise<UserId | null> {
    if (!this.platforms.has(platformId)) return Promise.resolve(null);
    return Promise.resolve(this.rows.get(JSON.stringify([platformId, subject]))?.userId ?? null);
  }
}

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const mac = (key: string, body: string) => createHmac('sha256', key).update(body).digest();

/**
 * A pretend course system's signing key for tests: `claims.signature` tokens, HMAC SHA-256 under
 * a key the matching verifier finds by the platform's key set address.
 */
export class FakeLtiTokens {
  static readonly jwksUrl = 'https://lms.example.edu/jwks';

  constructor(
    readonly key = 'fake-lti-platform-key',
    readonly jwksUrl = FakeLtiTokens.jwksUrl,
  ) {}

  sign(claims: Readonly<Record<string, unknown>>): Promise<string> {
    const body = encode(claims);
    return Promise.resolve(`${body}.${mac(this.key, body).toString('base64url')}`);
  }

  signWithOtherKey(claims: Readonly<Record<string, unknown>>): Promise<string> {
    return new FakeLtiTokens('some-other-key', this.jwksUrl).sign(claims);
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Verifies FakeLtiTokens: signature, issuer, audience and expiry, like the real verifier. */
export class FakeLtiTokenVerifier implements LtiTokenVerifier {
  private readonly keys: ReadonlyMap<string, string>;

  constructor(
    tokens: readonly FakeLtiTokens[] = [new FakeLtiTokens()],
    private readonly now: () => Date = () => new Date(),
  ) {
    this.keys = new Map(tokens.map((token) => [token.jwksUrl, token.key]));
  }

  verify(idToken: string, check: LtiTokenCheck): Promise<Result<unknown, 'invalid_token'>> {
    return Promise.resolve(this.check(idToken, check));
  }

  private check(idToken: string, check: LtiTokenCheck): Result<unknown, 'invalid_token'> {
    const [body = '', signature = '', ...rest] = idToken.split('.');
    const key = this.keys.get(check.jwksUrl);
    const given = Buffer.from(signature, 'base64url');
    const expected = key === undefined ? undefined : mac(key, body);
    if (rest.length > 0 || expected?.length !== given.length) {
      return err('invalid_token');
    }
    if (!timingSafeEqual(given, expected)) return err('invalid_token');
    let claims: unknown;
    try {
      claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return err('invalid_token');
    }
    if (!isRecord(claims) || claims.iss !== check.issuer) return err('invalid_token');
    const audiences: unknown[] = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(check.audience)) return err('invalid_token');
    const exp = claims.exp;
    if (typeof exp !== 'number' || exp * 1000 <= this.now().getTime()) return err('invalid_token');
    return ok(claims);
  }
}

/** A fixed, made-up public key: enough for pages that publish the tool's key set. */
export class FakeToolKeyStore implements ToolKeyStore {
  static readonly key: PublicJwk = {
    kty: 'RSA',
    kid: 'fake-tool-key-0001',
    alg: 'RS256',
    use: 'sig',
    n: 'fake-modulus',
    e: 'AQAB',
  };

  publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }> {
    return Promise.resolve({ keys: [FakeToolKeyStore.key] });
  }
}
