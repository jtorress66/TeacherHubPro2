import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWTVerifyGetKey,
} from 'jose';
import { ltiClaim, ltiRoles } from '@thp/domain';
import type { Clock, PublicJwk } from '@thp/ports';
import type { KeySetResolver } from './jose-lti-token-verifier.ts';

const kid = 'test-lms';
const learnerRole = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
const systemClock: Clock = { now: () => new Date() };

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
  private readonly clock: Clock;
  private keys: Promise<Keys> | undefined;

  constructor(config: {
    readonly issuer: string;
    readonly jwksUrl: string;
    readonly clock?: Clock;
  }) {
    this.issuer = config.issuer;
    this.jwksUrl = config.jwksUrl;
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

  /** A resource link launch from the test course, as Canvas or Moodle would send it. */
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
      [ltiClaim.messageType]: 'LtiResourceLinkRequest',
      [ltiClaim.deploymentId]: LocalLtiPlatform.deploymentId,
      [ltiClaim.roles]: [launch.role === 'teacher' ? ltiRoles.instructor : learnerRole],
      [ltiClaim.context]: { id: 'test-course', title: 'Test course' },
      [ltiClaim.resourceLink]: { id: 'test-link' },
      ...(launch.locale === undefined
        ? {}
        : { [ltiClaim.launchPresentation]: { locale: launch.locale } }),
    });
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
