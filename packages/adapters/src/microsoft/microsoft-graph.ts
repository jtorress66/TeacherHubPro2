import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftError,
  MicrosoftGrantScope,
  OneDriveFile,
  OneDriveFiles,
} from '@thp/ports';
import { microsoftRefusal } from './microsoft-refusal.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** The Microsoft identity platform (v2.0), for work, school and personal accounts alike. */
const identity = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const graph = 'https://graph.microsoft.com/v1.0';
/**
 * Signing in (openid, User.Read), staying connected (offline_access) and saving files in the
 * teacher's own OneDrive (Files.ReadWrite).
 */
const oneDriveScopes = 'openid offline_access User.Read Files.ReadWrite';
/**
 * Teams, for school accounts only (the Edu permissions need the school's administrator to
 * approve the app): the teacher's classes and their students' names (EduRoster.ReadBasic),
 * assignments, including the resources folder a Word document goes in (EduAssignments.ReadWrite,
 * the least the resources folder accepts), and putting the document in that folder, which is in
 * the class's SharePoint site, not the teacher's own OneDrive (Files.ReadWrite.All).
 */
export const teamsScopes = [
  'EduRoster.ReadBasic',
  'EduAssignments.ReadWrite',
  'Files.ReadWrite.All',
] as const;
const scopesFor = ({ teams }: MicrosoftGrantScope) =>
  teams ? `${oneDriveScopes} ${teamsScopes.join(' ')}` : oneDriveScopes;
/** The folder in the teacher's OneDrive where TeacherHubPro saves files. */
const folder = 'TeacherHubPro';

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});
const tokenError = z.object({
  error: z.string(),
  error_codes: z.array(z.number()).optional(),
});
const driveItem = z.object({ webUrl: z.url() });
/** AADSTS65001: the user or administrator has not consented to (some of) the scopes asked for. */
const notConsented = 65001;

/**
 * Whether the token response's scopes include every Teams permission. Microsoft may name them
 * with the Graph address in front; a response without `scope` covers what was asked.
 */
function grantsTeams(scope: string | undefined): boolean {
  if (scope === undefined) return true;
  const granted = new Set(
    scope
      .split(' ')
      .map((name) => name.replace(/^https:\/\/graph\.microsoft\.com\//iu, '').toLowerCase()),
  );
  return teamsScopes.every((name) => granted.has(name.toLowerCase()));
}

/**
 * What the token endpoint's refusal means: Teams asked for but not (or no longer) consented to,
 * a revoked or used grant, a busy service, or else.
 */
async function tokenFailure(
  response: Response,
  scope: MicrosoftGrantScope,
): Promise<MicrosoftError> {
  if (response.status === 429) return { code: 'throttled' };
  if (response.status !== 400) return { code: 'unavailable' };
  const body = tokenError.safeParse(await response.json().catch(() => null));
  if (!body.success) return { code: 'unavailable' };
  const { error } = body.data;
  const unconsented =
    (body.data.error_codes ?? []).includes(notConsented) ||
    error === 'consent_required' ||
    error === 'invalid_scope';
  if (scope.teams && unconsented) return { code: 'insufficient_scope' };
  return { code: error === 'invalid_grant' ? 'unauthorized' : 'unavailable' };
}

interface Granted {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly teams: boolean;
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

  /**
   * Teams is asked for on top of what was granted before (incremental consent). There is no
   * prompt=consent: in a school whose administrator approved the app for everyone, forcing the
   * teacher's own consent would ask them for permissions only an administrator can grant.
   */
  authorizationUrl(
    input: {
      readonly state: string;
      readonly codeChallenge: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): string {
    const url = new URL(`${identity}/authorize`);
    url.searchParams.set('client_id', this.client.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scopesFor(input));
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  private async token(
    grant: Record<string, string>,
    scope: MicrosoftGrantScope,
  ): Promise<Result<Granted, MicrosoftError>> {
    try {
      const response = await this.fetchFn(`${identity}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.client.clientId,
          client_secret: this.client.clientSecret,
          scope: scopesFor(scope),
          ...grant,
        }).toString(),
      });
      if (!response.ok) return err(await tokenFailure(response, scope));
      const granted = tokenResponse.safeParse(await response.json());
      if (!granted.success) return err({ code: 'unavailable' });
      const { access_token: accessToken, refresh_token: refreshToken } = granted.data;
      const teams = scope.teams && grantsTeams(granted.data.scope);
      return ok(
        refreshToken === undefined ? { accessToken, teams } : { accessToken, refreshToken, teams },
      );
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  /** Asked for Teams, a personal account's grant comes back without the Teams scopes. */
  async exchangeCode(
    input: {
      readonly code: string;
      readonly codeVerifier: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): Promise<Result<{ readonly refreshToken: string; readonly teams: boolean }, MicrosoftError>> {
    const granted = await this.token(
      {
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
      },
      input,
    );
    if (!granted.ok) return granted;
    const { refreshToken, teams } = granted.value;
    return refreshToken === undefined ? err({ code: 'unavailable' }) : ok({ refreshToken, teams });
  }

  /**
   * Asks only for what the call needs (Teams or not). Microsoft may or may not send a new refresh
   * token; without one, the one used still works.
   */
  async refresh(
    refreshToken: string,
    scope: MicrosoftGrantScope,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    const granted = await this.token(
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      scope,
    );
    if (!granted.ok) return granted;
    if (scope.teams && !granted.value.teams) return err({ code: 'insufficient_scope' });
    return ok({
      accessToken: granted.value.accessToken,
      refreshToken: granted.value.refreshToken ?? refreshToken,
    });
  }

  refusal(response: {
    readonly error: string;
    readonly description: string | null;
  }): MicrosoftError {
    return microsoftRefusal(response);
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
