import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { err, ok, type Result } from '@thp/domain';
import type { Clock, LtiTokenCheck, LtiTokenVerifier } from '@thp/ports';

/** Finds the public keys at a course system's key set address. */
export type KeySetResolver = (jwksUrl: string) => JWTVerifyGetKey;

/** Fetches the key set over HTTPS (cached by jose). */
export const remoteKeySet: KeySetResolver = (jwksUrl) => createRemoteJWKSet(new URL(jwksUrl));

/**
 * Checks LTI launch tokens with jose: an RS256 signature by one of the course system's published
 * keys, its issuer, audience and expiry. Each key set is fetched once and cached (jose refetches
 * it when a token names a key it has not seen). Tokens are never logged.
 */
export class JoseLtiTokenVerifier implements LtiTokenVerifier {
  private readonly keySets = new Map<string, JWTVerifyGetKey>();

  constructor(
    private readonly resolveKeys: KeySetResolver = remoteKeySet,
    private readonly clock?: Clock,
  ) {}

  async verify(idToken: string, check: LtiTokenCheck): Promise<Result<unknown, 'invalid_token'>> {
    try {
      const { payload } = await jwtVerify(idToken, this.keysAt(check.jwksUrl), {
        algorithms: ['RS256'],
        issuer: check.issuer,
        audience: check.audience,
        ...(this.clock === undefined ? {} : { currentDate: this.clock.now() }),
      });
      return ok(payload);
    } catch {
      return err('invalid_token');
    }
  }

  private keysAt(jwksUrl: string): JWTVerifyGetKey {
    const known = this.keySets.get(jwksUrl);
    if (known !== undefined) return known;
    const keys = this.resolveKeys(jwksUrl);
    this.keySets.set(jwksUrl, keys);
    return keys;
  }
}
