import { err, ok, type Result } from '@thp/domain';
import type { ClassroomAuthorization, ClassroomError } from '@thp/ports';
import type { GoogleOAuthCredentials } from './google-oauth-identity.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const authorizeEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';

/** Only what sharing and roster import need. */
export const classroomScopes = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students',
] as const;

/**
 * Asks a teacher for Classroom access through Google's official OAuth 2.0 endpoints, offline so a
 * refresh token is returned; access tokens are fetched from it when needed and never stored.
 */
export class GoogleClassroomAuthorization implements ClassroomAuthorization {
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
      scope: classroomScopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    }).toString();
    return url.toString();
  }

  private async token(
    form: Record<string, string>,
  ): Promise<Result<Record<string, unknown>, ClassroomError>> {
    try {
      const response = await this.fetchFn(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          ...form,
        }).toString(),
      });
      if (!response.ok)
        return err({ code: response.status >= 500 ? 'unavailable' : 'unauthorized' });
      const body: unknown = await response.json();
      return ok(typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {});
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Result<{ readonly refreshToken: string }, ClassroomError>> {
    const body = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    if (!body.ok) return body;
    const refresh = body.value.refresh_token;
    return typeof refresh === 'string' && refresh !== ''
      ? ok({ refreshToken: refresh })
      : err({ code: 'unauthorized' });
  }

  async accessToken(refreshToken: string): Promise<Result<string, ClassroomError>> {
    const body = await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (!body.ok) return body;
    const access = body.value.access_token;
    return typeof access === 'string' && access !== '' ? ok(access) : err({ code: 'unauthorized' });
  }
}
