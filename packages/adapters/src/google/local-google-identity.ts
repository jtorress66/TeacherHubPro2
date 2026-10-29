import { createHmac, timingSafeEqual } from 'node:crypto';
import { err, ok, type Result } from '@thp/domain';
import type { GoogleIdentity, GoogleIdentityError, GoogleProfile } from '@thp/ports';

const sign = (secret: string, body: string): string =>
  createHmac('sha256', secret).update(body).digest('base64url');

/** A code for the local test sign-in: the profile, signed so it cannot be forged. */
export function issueLocalGoogleCode(secret: string, profile: GoogleProfile): string {
  const body = Buffer.from(JSON.stringify(profile)).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

/**
 * Development and E2E stand-in for Google: an in-app page lets you pick a test account and
 * returns a signed code. The web config refuses it in production.
 */
export class LocalGoogleIdentity implements GoogleIdentity {
  constructor(
    private readonly appUrl: string,
    private readonly secret: string,
  ) {}

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL('/auth/local-google', this.appUrl);
    url.search = new URLSearchParams({ state, redirect_uri: redirectUri }).toString();
    return url.toString();
  }

  exchangeCode(code: string): Promise<Result<GoogleProfile, GoogleIdentityError>> {
    const [body = '', signature = ''] = code.split('.');
    const expected = Buffer.from(sign(this.secret, body));
    const given = Buffer.from(signature);
    if (body === '' || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return Promise.resolve(err({ code: 'invalid_code' }));
    }
    const profile = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as GoogleProfile;
    return Promise.resolve(ok(profile));
  }
}
