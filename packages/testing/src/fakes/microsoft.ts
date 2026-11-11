import { err, ok, type Result } from '@thp/domain';
import type {
  MicrosoftAuthorization,
  MicrosoftError,
  OneDriveFile,
  OneDriveFiles,
} from '@thp/ports';

/**
 * Microsoft's sign-in, as Microsoft behaves: a code works only with its PKCE verifier, and a
 * refresh may or may not come with a new refresh token (`rotates`).
 */
export class FakeMicrosoftAuthorization implements MicrosoftAuthorization {
  static readonly code = 'microsoft-code';
  static readonly verifier = 'microsoft-verifier';
  static readonly accessToken = 'microsoft-access';
  /** Whether a refresh issues a new refresh token (Microsoft may or may not). */
  rotates = true;
  /** Makes the next refresh fail with this reason. */
  failWith: MicrosoftError['code'] | null = null;
  private issued = 0;
  private readonly live = new Set<string>();

  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string {
    const url = new URL('https://login.microsoft.test/common/oauth2/v2.0/authorize');
    url.searchParams.set('state', input.state);
    url.searchParams.set('code_challenge', input.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('redirect_uri', input.redirectUri);
    return url.toString();
  }

  private next(): string {
    this.issued += 1;
    const token = `microsoft-refresh-${String(this.issued)}`;
    this.live.add(token);
    return token;
  }

  exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<Result<{ readonly refreshToken: string }, MicrosoftError>> {
    const valid =
      input.code === FakeMicrosoftAuthorization.code &&
      input.codeVerifier === FakeMicrosoftAuthorization.verifier;
    return Promise.resolve(
      valid ? ok({ refreshToken: this.next() }) : err({ code: 'unauthorized' }),
    );
  }

  refresh(
    refreshToken: string,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  > {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return Promise.resolve(err({ code }));
    }
    if (!this.live.has(refreshToken)) return Promise.resolve(err({ code: 'unauthorized' }));
    if (this.rotates) this.live.delete(refreshToken);
    return Promise.resolve(
      ok({
        accessToken: FakeMicrosoftAuthorization.accessToken,
        refreshToken: this.rotates ? this.next() : refreshToken,
      }),
    );
  }

  /** As when the teacher removes the app from their Microsoft account: every token stops. */
  removeApp(): void {
    this.live.clear();
  }
}

/** OneDrive uploads, recorded; `failWith` makes the next upload fail. */
export class FakeOneDriveFiles implements OneDriveFiles {
  readonly uploads: OneDriveFile[] = [];
  failWith: MicrosoftError['code'] | null = null;

  upload(
    accessToken: string,
    file: OneDriveFile,
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>> {
    if (this.failWith !== null) {
      const code = this.failWith;
      this.failWith = null;
      return Promise.resolve(err({ code }));
    }
    if (accessToken !== FakeMicrosoftAuthorization.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.uploads.push(file);
    return Promise.resolve(
      ok({ webUrl: `https://onedrive.test/TeacherHubPro/${encodeURIComponent(file.name)}` }),
    );
  }
}
