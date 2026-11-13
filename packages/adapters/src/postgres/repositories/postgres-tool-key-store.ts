import { exportJWK, generateKeyPair } from 'jose';
import type { Kysely } from 'kysely';
import type {
  Clock,
  PublicJwk,
  RandomTokenGenerator,
  SecretCipher,
  ToolKeyStore,
} from '@thp/ports';
import type { Database } from '../schema.ts';

const algorithm = 'RS256';

const isPublicJwk = (value: unknown): value is PublicJwk =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((member) => typeof member === 'string');

/**
 * TeacherHubPro's RSA signing keys for LTI, kept in Postgres: made on first use, the private half
 * sealed with the token cipher (never logged), the public half published as a key set.
 */
export class PostgresToolKeyStore implements ToolKeyStore {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly deps: {
      readonly cipher: SecretCipher;
      readonly tokens: RandomTokenGenerator;
      readonly clock: Clock;
    },
  ) {}

  async publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }> {
    const keys = await this.stored();
    return { keys: keys.length > 0 ? keys : [await this.create()] };
  }

  private async stored(): Promise<PublicJwk[]> {
    const rows = await this.db
      .selectFrom('tool_keys')
      .select('public_jwk')
      .orderBy('created_at')
      .orderBy('kid')
      .execute();
    return rows.map((row) => row.public_jwk).filter(isPublicJwk);
  }

  private async create(): Promise<PublicJwk> {
    const { publicKey, privateKey } = await generateKeyPair(algorithm, { extractable: true });
    const kid = this.deps.tokens.generate();
    const { kty = 'RSA', n = '', e = '' } = await exportJWK(publicKey);
    const jwk: PublicJwk = { kty, n, e, kid, alg: algorithm, use: 'sig' };
    const sealed = await this.deps.cipher.encrypt(JSON.stringify(await exportJWK(privateKey)));
    await this.db
      .insertInto('tool_keys')
      .values({
        kid,
        private_key_encrypted: sealed,
        public_jwk: JSON.stringify(jwk),
        created_at: this.deps.clock.now(),
      })
      .execute();
    return jwk;
  }
}
