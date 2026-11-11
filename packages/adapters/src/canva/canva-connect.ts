import { err, ok, type Result } from '@thp/domain';
import type { CanvaAuthorization, CanvaDesigns, CanvaError, CanvaFile } from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const authorizeUrl = 'https://www.canva.com/api/oauth/authorize';
const api = 'https://api.canva.com/rest/v1';
/** Only what importing a file into the teacher's account needs. */
const scopes = 'design:content:write';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const failureOf = (status: number): CanvaError => ({
  code:
    status === 401 || status === 403
      ? 'unauthorized'
      : status === 429
        ? 'throttled'
        : 'unavailable',
});

/** Canva's OAuth (authorization code with PKCE); the client secret stays on the server. */
export class CanvaConnectAuthorization implements CanvaAuthorization {
  constructor(
    private readonly client: { readonly clientId: string; readonly clientSecret: string },
    private readonly fetchFn: Fetch = fetch,
  ) {}

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL(authorizeUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.client.clientId);
    url.searchParams.set('redirect_uri', input.redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 's256');
    return url.toString();
  }

  private async token(
    body: Record<string, string>,
  ): Promise<Result<{ readonly accessToken: string; readonly refreshToken: string }, CanvaError>> {
    try {
      const credentials = Buffer.from(
        `${this.client.clientId}:${this.client.clientSecret}`,
      ).toString('base64');
      const response = await this.fetchFn(`${api}/oauth/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${credentials}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body).toString(),
      });
      // A used, revoked or mistyped code or refresh token is a 400 (invalid_grant).
      if (!response.ok) {
        return err(response.status === 400 ? { code: 'unauthorized' } : failureOf(response.status));
      }
      const granted: unknown = await response.json();
      if (
        !isRecord(granted) ||
        typeof granted.access_token !== 'string' ||
        typeof granted.refresh_token !== 'string'
      ) {
        return err({ code: 'unavailable' });
      }
      return ok({ accessToken: granted.access_token, refreshToken: granted.refresh_token });
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  async exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<Result<{ readonly refreshToken: string }, CanvaError>> {
    const granted = await this.token({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    });
    return granted.ok ? ok({ refreshToken: granted.value.refreshToken }) : granted;
  }

  refresh(
    refreshToken: string,
  ): Promise<Result<{ readonly accessToken: string; readonly refreshToken: string }, CanvaError>> {
    return this.token({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }
}

const jobErrors: Readonly<Record<string, CanvaError['code']>> = {
  invalid_file: 'invalid_file',
  design_import_throttled: 'throttled',
  design_creation_throttled: 'throttled',
};

type JobState =
  | { readonly status: 'in_progress'; readonly id: string }
  | { readonly status: 'success'; readonly editUrl: string }
  | { readonly status: 'failed'; readonly error: CanvaError };

function jobState(body: unknown): JobState | null {
  const job = isRecord(body) && isRecord(body.job) ? body.job : null;
  if (job === null || typeof job.id !== 'string') return null;
  if (job.status === 'in_progress') return { status: 'in_progress', id: job.id };
  if (job.status === 'failed') {
    const code = isRecord(job.error) && typeof job.error.code === 'string' ? job.error.code : '';
    return { status: 'failed', error: { code: jobErrors[code] ?? 'unavailable' } };
  }
  const designs =
    isRecord(job.result) && Array.isArray(job.result.designs) ? job.result.designs : [];
  const first: unknown = designs[0];
  const editUrl = isRecord(first) && isRecord(first.urls) ? first.urls.edit_url : null;
  return typeof editUrl === 'string' ? { status: 'success', editUrl } : null;
}

/**
 * Canva's design import API: sends the file, then checks the import job until Canva has made
 * the design (about a second apart, for at most `maxChecks` checks).
 */
export class CanvaConnectDesigns implements CanvaDesigns {
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly wait: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    private readonly maxChecks = 30,
  ) {}

  private async read(response: Response): Promise<Result<JobState, CanvaError>> {
    if (!response.ok) return err(failureOf(response.status));
    const state = jobState(await response.json());
    return state === null ? err({ code: 'unavailable' }) : ok(state);
  }

  async importFile(
    accessToken: string,
    file: CanvaFile,
  ): Promise<Result<{ readonly editUrl: string }, CanvaError>> {
    try {
      let state = await this.read(
        await this.fetchFn(`${api}/imports`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/octet-stream',
            'import-metadata': JSON.stringify({
              title_base64: Buffer.from(file.title).toString('base64'),
              mime_type: file.mimeType,
            }),
          },
          // A copy on its own ArrayBuffer, which fetch accepts as a body everywhere.
          body: new Uint8Array(file.bytes),
        }),
      );
      for (let check = 0; state.ok && state.value.status === 'in_progress'; check++) {
        if (check >= this.maxChecks) return err({ code: 'unavailable' });
        await this.wait(1000);
        state = await this.read(
          await this.fetchFn(`${api}/imports/${encodeURIComponent(state.value.id)}`, {
            headers: { authorization: `Bearer ${accessToken}` },
          }),
        );
      }
      if (!state.ok) return state;
      return state.value.status === 'success'
        ? ok({ editUrl: state.value.editUrl })
        : err(state.value.status === 'failed' ? state.value.error : { code: 'unavailable' });
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
