import type { LtiPlatform, LtiPlatformId, Result, SchoolId, UserId } from '@thp/domain';

/** The course systems schools have registered for LTI launches. */
export interface LtiPlatformRepository {
  save(platform: LtiPlatform): Promise<void>;
  findById(schoolId: SchoolId, id: LtiPlatformId): Promise<LtiPlatform | null>;
  /**
   * The platforms with this issuer (and client ID, when given), in any school: a launch names
   * its course system before anyone is known. An issuer and client ID pair is registered once.
   */
  findByIssuer(issuer: string, clientId: string | null): Promise<readonly LtiPlatform[]>;
  listForSchool(schoolId: SchoolId): Promise<readonly LtiPlatform[]>;
  delete(schoolId: SchoolId, id: LtiPlatformId): Promise<void>;
}

/** Launch nonces already used, so a launch token works once. */
export interface LtiNonceRepository {
  /** Marks the nonce used until it expires; false when it was already used. */
  claim(nonce: string, expiresAt: Date): Promise<boolean>;
}

/** Which TeacherHubPro account a course system's user is, once they have linked them. */
export interface LtiUserLinkRepository {
  /** Links the course system's user to the account, replacing any earlier link. */
  link(platformId: LtiPlatformId, subject: string, userId: UserId, linkedAt: Date): Promise<void>;
  findUserId(platformId: LtiPlatformId, subject: string): Promise<UserId | null>;
}

export interface LtiTokenCheck {
  readonly jwksUrl: string;
  readonly issuer: string;
  readonly audience: string;
}

/**
 * Checks a launch token's signature against the course system's public keys, and its issuer,
 * audience and expiry; the domain checks the rest of its claims.
 */
export interface LtiTokenVerifier {
  verify(idToken: string, check: LtiTokenCheck): Promise<Result<unknown, 'invalid_token'>>;
}

/** One public key in a JSON Web Key Set. */
export interface PublicJwk {
  readonly kty: string;
  readonly kid: string;
  readonly alg: string;
  readonly use: string;
  readonly [member: string]: string;
}

/** TeacherHubPro's own signing keys, published for course systems; made on first use. */
export interface ToolKeyStore {
  publicKeySet(): Promise<{ readonly keys: readonly PublicJwk[] }>;
}
