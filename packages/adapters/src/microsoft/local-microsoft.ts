import { createHash } from 'node:crypto';
import { err, ok, type Result } from '@thp/domain';
import type { MicrosoftAuthorization, MicrosoftError, OneDriveFiles } from '@thp/ports';

// Stand-ins for Microsoft in local runs and E2E tests: no Microsoft account, no network.

const codePrefix = 'local-microsoft-code.';
const refreshPrefix = 'local-microsoft-refresh-';

export const localMicrosoftFixture = { accessToken: 'local-microsoft-access' } as const;

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Grants access at once: the address goes straight back to the app, the challenge in the code. */
export class LocalMicrosoftAuthorization implements MicrosoftAuthorization {
  private issued = 0;

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL(input.redirectUri);
    url.searchParams.set('code', `${codePrefix}${input.codeChallenge}`);
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<Result<{ readonly refreshToken: string }, MicrosoftError>> {
    if (input.code !== `${codePrefix}${challengeOf(input.codeVerifier)}`) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.issued += 1;
    return Promise.resolve(ok({ refreshToken: `${refreshPrefix}${String(this.issued)}` }));
  }

  /** Keeps the same refresh token, as Microsoft sometimes does. */
  refresh(
    refreshToken: string,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    return Promise.resolve(
      refreshToken.startsWith(refreshPrefix)
        ? ok({ accessToken: localMicrosoftFixture.accessToken, refreshToken })
        : err({ code: 'unauthorized' }),
    );
  }
}

/** A stand-in for OneDrive: files are not kept, only given a link. */
export class LocalOneDriveFiles implements OneDriveFiles {
  upload(
    accessToken: string,
    file: { readonly name: string },
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>> {
    if (accessToken !== localMicrosoftFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    return Promise.resolve(
      ok({ webUrl: `https://onedrive.local/TeacherHubPro/${encodeURIComponent(file.name)}` }),
    );
  }
}
