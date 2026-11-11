import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftError,
  OneDriveFile,
  OneDriveFiles,
} from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** The Microsoft identity platform (v2.0), for work, school and personal accounts alike. */
const identity = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const graph = 'https://graph.microsoft.com/v1.0';
/**
 * Signing in (openid, User.Read), staying connected (offline_access) and saving files in the
 * teacher's own OneDrive (Files.ReadWrite).
 */
const scopes = 'openid offline_access User.Read Files.ReadWrite';
/** The folder in the teacher's OneDrive where TeacherHubPro saves files. */
const folder = 'TeacherHubPro';

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
});
const tokenError = z.object({ error: z.string() });
const driveItem = z.object({ webUrl: z.url() });

/** What the token endpoint's refusal means: a revoked or used grant, a busy service, or else. */
async function tokenFailure(response: Response): Promise<MicrosoftError> {
  if (response.status === 429) return { code: 'throttled' };
  if (response.status !== 400) return { code: 'unavailable' };
  const body = tokenError.safeParse(await response.json().catch(() => null));
  return {
    code: body.success && body.data.error === 'invalid_grant' ? 'unauthorized' : 'unavailable',
  };
}

/**
 * Microsoft's OAuth (authorization code with PKCE) for a confidential client: the client secret
 * stays on the server. Microsoft has no per-app revoke for delegated grants, so there is none.
 */
export class MicrosoftIdentityAuthorization implements MicrosoftAuthorization {
  constructor(
    private readonly client: { readonly clientId: string; readonly clientSecret: string },
    private readonly fetchFn: Fetch = fetch,
  ) {}

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL(`${identity}/authorize`);
    url.searchParams.set('client_id', this.client.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  private async token(
    grant: Record<string, string>,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken?: string }, MicrosoftError>
  > {
    try {
      const response = await this.fetchFn(`${identity}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.client.clientId,
          client_secret: this.client.clientSecret,
          scope: scopes,
          ...grant,
        }).toString(),
      });
      if (!response.ok) return err(await tokenFailure(response));
      const granted = tokenResponse.safeParse(await response.json());
      if (!granted.success) return err({ code: 'unavailable' });
      const { access_token: accessToken, refresh_token: refreshToken } = granted.data;
      return ok(refreshToken === undefined ? { accessToken } : { accessToken, refreshToken });
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  async exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<Result<{ readonly refreshToken: string }, MicrosoftError>> {
    const granted = await this.token({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    });
    if (!granted.ok) return granted;
    const { refreshToken } = granted.value;
    return refreshToken === undefined ? err({ code: 'unavailable' }) : ok({ refreshToken });
  }

  /** Microsoft may or may not send a new refresh token; without one, the one used still works. */
  async refresh(
    refreshToken: string,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    const granted = await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (!granted.ok) return granted;
    return ok({
      accessToken: granted.value.accessToken,
      refreshToken: granted.value.refreshToken ?? refreshToken,
    });
  }
}

const uploadFailure = (status: number): MicrosoftError => ({
  code:
    status === 401
      ? 'unauthorized'
      : status === 429 || status === 503
        ? 'throttled'
        : 'unavailable',
});

/**
 * Microsoft Graph's simple upload (files up to 250 MB) into the teacher's OneDrive, in the
 * TeacherHubPro folder (made on first use); a file with the same name gets a new name.
 */
export class OneDriveGraphFiles implements OneDriveFiles {
  constructor(private readonly fetchFn: Fetch = fetch) {}

  async upload(
    accessToken: string,
    file: OneDriveFile,
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>> {
    const path = `${folder}/${encodeURIComponent(file.name)}`;
    try {
      const response = await this.fetchFn(
        `${graph}/me/drive/root:/${path}:/content?@microsoft.graph.conflictBehavior=rename`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${accessToken}`, 'content-type': file.mimeType },
          // A copy on its own ArrayBuffer, which fetch accepts as a body everywhere.
          body: new Uint8Array(file.bytes),
        },
      );
      if (!response.ok) return err(uploadFailure(response.status));
      const item = driveItem.safeParse(await response.json());
      return item.success ? ok({ webUrl: item.data.webUrl }) : err({ code: 'unavailable' });
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
