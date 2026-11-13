import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
} from 'jose';
import { ltiClaim, ltiMessageType, ltiRoles } from '@thp/domain';
import type { Clock, PublicJwk } from '@thp/ports';
import type { KeySetResolver } from './jose-lti-token-verifier.ts';

const kid = 'test-lms';
const membership = 'http://purl.imsglobal.org/vocab/lis/v2/membership';
const learnerRole = `${membership}#Learner`;
const systemClock: Clock = { now: () => new Date() };
const membershipsScope =
  'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';
/** The audience of the access tokens it grants: its own services. */
const servicesAudience = 'test-lms-services';
const course = { id: 'test-course', label: 'TEST', title: 'Test course' } as const;

/**
 * The test course's class list: two active learners, its teacher, a learner who left, and a
 * learner whose name the course system keeps to itself.
 */
const classList = [
  {
    user_id: 'student-1',
    status: 'Active',
    name: 'Ana Rivera',
    given_name: 'Ana',
    family_name: 'Rivera',
    email: 'ana.rivera@test-lms.example',
    roles: [learnerRole],
  },
  {
    user_id: 'student-2',
    status: 'Active',
    name: 'Ben Ortiz',
    given_name: 'Ben',
    family_name: 'Ortiz',
    email: 'ben.ortiz@test-lms.example',
    roles: [learnerRole],
  },
  { user_id: 'teacher-1', status: 'Active', name: 'Test Teacher', roles: [ltiRoles.instructor] },
  {
    user_id: 'student-3',
    status: 'Inactive',
    name: 'Cam Diaz',
    given_name: 'Cam',
    family_name: 'Diaz',
    roles: [learnerRole],
  },
  { user_id: 'student-4', status: 'Active', roles: [learnerRole] },
] as const;

/** A client credentials request for the course system's services, as the form carries it. */
export interface ServiceTokenRequest {
  readonly grantType: string | null;
  readonly clientAssertionType: string | null;
  readonly clientAssertion: string | null;
  readonly scope: string | null;
}

/** A Names and Role Provisioning class list (membership container). */
export interface LocalClassList {
  readonly id: string;
  readonly context: typeof course;
  readonly members: readonly unknown[];
}

interface Keys {
  readonly privateKey: CryptoKey;
  readonly publicJwk: PublicJwk;
}

/** A launch the pretend course system signs. */
export interface LocalLaunch {
  readonly clientId: string;
  readonly subject: string;
  readonly role: 'teacher' | 'learner';
  readonly nonce: string;
  readonly locale?: string;
  /** A deep linking request ("Add content") in place of a resource link launch. */
  readonly deepLinking?: { readonly returnUrl: string; readonly data: string };
  /** The custom parameters of the link launched (a placed item's). */
  readonly custom?: Readonly<Record<string, string>>;
}

/** A link the tool placed in the test course: its title and custom parameters. */
export interface LocalPlacedLink {
  readonly title: string;
  readonly custom: Readonly<Record<string, string>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The tool's placed links, leaving out any item that is not a titled link. */
function placedLinks(items: unknown): LocalPlacedLink[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown) => {
    if (!isRecord(item) || item.type !== 'ltiResourceLink' || typeof item.title !== 'string') {
      return [];
    }
    const custom = isRecord(item.custom) ? item.custom : {};
    const strings = Object.entries(custom).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    );
    return [{ title: item.title, custom: Object.fromEntries(strings) }];
  });
}

/**
 * A pretend course system for development and tests (LTI_PROVIDER=local): its own RSA key, made
 * once per process, a public key set, and signed launches. Never used in production.
 */
export class LocalLtiPlatform {
  static readonly deploymentId = 'test-deployment-1';
  /** The one deployment its launches come from. */
  readonly deploymentId = LocalLtiPlatform.deploymentId;
  readonly issuer: string;
  readonly jwksUrl: string;
  /** Its OAuth token address, for its services; none without one. */
  readonly tokenUrl: string | null;
  /** Its class list address, offered in launches; none without one. */
  readonly membershipsUrl: string | null;
  private readonly clock: Clock;
  private keys: Promise<Keys> | undefined;

  constructor(config: {
    readonly issuer: string;
    readonly jwksUrl: string;
    readonly tokenUrl?: string;
    readonly membershipsUrl?: string;
    readonly clock?: Clock;
  }) {
    this.issuer = config.issuer;
    this.jwksUrl = config.jwksUrl;
    this.tokenUrl = config.tokenUrl ?? null;
    this.membershipsUrl = config.membershipsUrl ?? null;
    this.clock = config.clock ?? systemClock;
  }

  async publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }> {
    return { keys: [(await this.signingKeys()).publicJwk] };
  }

  async sign(claims: Readonly<Record<string, unknown>>): Promise<string> {
    const { privateKey } = await this.signingKeys();
    return new SignJWT({ ...claims }).setProtectedHeader({ alg: 'RS256', kid }).sign(privateKey);
  }

  /**
   * A key set resolver that reads this platform's keys without a network round trip, and asks
   * `others` for any other course system's address.
   */
  keyResolver(others: KeySetResolver): KeySetResolver {
    const own: JWTVerifyGetKey = async (header, token) =>
      createLocalJWKSet({ keys: [...(await this.publicKeySet()).keys] })(header, token);
    return (jwksUrl) => (jwksUrl === this.jwksUrl ? own : others(jwksUrl));
  }

  /**
   * A resource link launch from the test course, as Canvas or Moodle would send it, or a deep
   * linking request when its teacher adds content (several items accepted).
   */
  launchToken(launch: LocalLaunch): Promise<string> {
    const seconds = Math.floor(this.clock.now().getTime() / 1000);
    return this.sign({
      iss: this.issuer,
      aud: launch.clientId,
      sub: launch.subject,
      iat: seconds,
      exp: seconds + 300,
      nonce: launch.nonce,
      [ltiClaim.version]: '1.3.0',
      [ltiClaim.deploymentId]: LocalLtiPlatform.deploymentId,
      [ltiClaim.roles]: [launch.role === 'teacher' ? ltiRoles.instructor : learnerRole],
      [ltiClaim.context]: course,
      ...(launch.deepLinking === undefined
        ? {
            [ltiClaim.messageType]: ltiMessageType.resourceLink,
            [ltiClaim.resourceLink]: { id: 'test-link' },
          }
        : {
            [ltiClaim.messageType]: ltiMessageType.deepLinking,
            [ltiClaim.deepLinkingSettings]: {
              deep_link_return_url: launch.deepLinking.returnUrl,
              accept_types: ['ltiResourceLink'],
              accept_presentation_document_targets: ['window', 'iframe'],
              accept_multiple: true,
              data: launch.deepLinking.data,
            },
          }),
      ...(launch.custom === undefined ? {} : { [ltiClaim.custom]: launch.custom }),
      ...(this.membershipsUrl === null
        ? {}
        : {
            [ltiClaim.namesRoleService]: {
              context_memberships_url: this.membershipsUrl,
              service_versions: ['2.0'],
            },
          }),
      ...(launch.locale === undefined
        ? {}
        : { [ltiClaim.launchPresentation]: { locale: launch.locale } }),
    });
  }

  /**
   * Answers a client credentials request for the class list: the tool's client assertion must be
   * signed by one of the tool's published keys, addressed to this token address, and current.
   * Returns an access token, or null when refused.
   */
  async grantServiceToken(
    request: ServiceTokenRequest,
    toolKeys: { readonly keys: readonly PublicJwk[] },
  ): Promise<string | null> {
    if (
      this.tokenUrl === null ||
      request.grantType !== 'client_credentials' ||
      request.clientAssertionType !== 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' ||
      request.clientAssertion === null ||
      !(request.scope ?? '').split(' ').includes(membershipsScope)
    ) {
      return null;
    }
    try {
      const { payload } = await jwtVerify(
        request.clientAssertion,
        createLocalJWKSet({ keys: [...toolKeys.keys] }),
        { algorithms: ['RS256'], audience: this.tokenUrl, currentDate: this.clock.now() },
      );
      if (typeof payload.iss !== 'string' || payload.iss !== payload.sub) return null;
      const seconds = Math.floor(this.clock.now().getTime() / 1000);
      return await this.sign({
        iss: this.issuer,
        aud: servicesAudience,
        sub: payload.iss,
        scope: membershipsScope,
        iat: seconds,
        exp: seconds + 300,
      });
    } catch {
      return null;
    }
  }

  /** The test course's class list, for a request carrying an access token it granted. */
  async classList(authorization: string | null): Promise<LocalClassList | null> {
    const token = /^Bearer (\S+)$/u.exec(authorization ?? '')?.[1];
    if (token === undefined || this.membershipsUrl === null) return null;
    try {
      const { payload } = await jwtVerify(token, await this.ownKeys(), {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: servicesAudience,
        currentDate: this.clock.now(),
      });
      if (payload.scope !== membershipsScope) return null;
    } catch {
      return null;
    }
    return { id: this.membershipsUrl, context: course, members: classList };
  }

  /**
   * The links in the tool's answer to a deep linking request: it must be signed by one of the
   * tool's published keys, from its client ID to this course system, current, and hand back the
   * request's data. Null when refused.
   */
  async readDeepLinkingResponse(
    jwt: string,
    toolKeys: { readonly keys: readonly PublicJwk[] },
    expected: { readonly clientId: string; readonly data: string },
  ): Promise<readonly LocalPlacedLink[] | null> {
    try {
      const { payload } = await jwtVerify(jwt, createLocalJWKSet({ keys: [...toolKeys.keys] }), {
        algorithms: ['RS256'],
        issuer: expected.clientId,
        audience: this.issuer,
        currentDate: this.clock.now(),
      });
      if (
        payload[ltiClaim.messageType] !== ltiMessageType.deepLinkingResponse ||
        payload[ltiClaim.deploymentId] !== this.deploymentId ||
        payload[ltiClaim.deepLinkingData] !== expected.data
      ) {
        return null;
      }
      return placedLinks(payload[ltiClaim.contentItems]);
    } catch {
      return null;
    }
  }

  private async ownKeys(): Promise<JWTVerifyGetKey> {
    return createLocalJWKSet({ keys: [...(await this.publicKeySet()).keys] });
  }

  private signingKeys(): Promise<Keys> {
    this.keys ??= (async () => {
      const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
      const { kty = 'RSA', n = '', e = '' } = await exportJWK(publicKey);
      return { privateKey, publicJwk: { kty, n, e, kid, alg: 'RS256', use: 'sig' } };
    })();
    return this.keys;
  }
}
