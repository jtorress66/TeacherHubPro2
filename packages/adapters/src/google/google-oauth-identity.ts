import { err, ok, parseEmail, type Result } from '@thp/domain';
import type { GoogleIdentity, GoogleIdentityError, GoogleProfile } from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GoogleOAuthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

const authorizeEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Google sign-in through Google's official OAuth 2.0 and OpenID Connect endpoints: the code is
 * exchanged server-to-server with our client secret, then the profile is read with the token.
 */
export class GoogleOAuthIdentity implements GoogleIdentity {
  constructor(
    private readonly credentials: GoogleOAuthCredentials,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  authorizationUrl(state: string, redirectUri: string): string {
    const url = new URL(authorizeEndpoint);
    url.search = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Result<GoogleProfile, GoogleIdentityError>> {
    try {
      const token = await this.fetchFn(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      if (token.status === 400) return err({ code: 'invalid_code' });
      if (!token.ok) return err({ code: 'unavailable' });
      const { access_token: accessToken } = (await token.json()) as { access_token?: unknown };

      const info = await this.fetchFn(userInfoEndpoint, {
        headers: { authorization: `Bearer ${String(accessToken)}` },
      });
      if (!info.ok) return err({ code: 'unavailable' });
      return toProfile(await info.json());
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}

function toProfile(body: unknown): Result<GoogleProfile, GoogleIdentityError> {
  if (!isRecord(body)) return err({ code: 'invalid_code' });
  const email = parseEmail('email', typeof body.email === 'string' ? body.email : undefined);
  if (!email.ok) return err({ code: 'invalid_code' });
  return ok({
    email: email.value,
    emailVerified: body.email_verified === true,
    name: typeof body.name === 'string' ? body.name : '',
    picture: typeof body.picture === 'string' ? body.picture : null,
  });
}
