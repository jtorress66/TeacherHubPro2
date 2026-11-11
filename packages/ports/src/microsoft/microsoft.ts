import type { Result } from '@thp/domain';

export interface MicrosoftError {
  /**
   * `unauthorized`: the teacher's access was revoked or expired; `throttled`: too many requests,
   * try again shortly; `unavailable`: Microsoft could not be reached or answered unexpectedly.
   */
  readonly code: 'unauthorized' | 'throttled' | 'unavailable';
}

/**
 * Asks a teacher for access to their Microsoft account (OAuth with PKCE) and keeps it usable.
 * Microsoft has no way for an app to revoke its own delegated grant, so there is no revoke:
 * disconnecting forgets the token, and the teacher can remove the app in their account.
 */
export interface MicrosoftAuthorization {
  /** Where to send the teacher to grant access; `state` comes back unchanged. */
  authorizationUrl(input: {
    readonly state: string;
    readonly codeChallenge: string;
    readonly redirectUri: string;
  }): string;
  exchangeCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<Result<{ readonly refreshToken: string }, MicrosoftError>>;
  /**
   * An access token, and the refresh token to keep: a new one when Microsoft issued one,
   * otherwise the one just used.
   */
  refresh(
    refreshToken: string,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  >;
}

/** A file to save in the teacher's OneDrive. */
export interface OneDriveFile {
  /** A name OneDrive accepts, with its extension (see `oneDriveFileName`). */
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

/** Saves files in the teacher's own OneDrive, in a TeacherHubPro folder. */
export interface OneDriveFiles {
  /** A file with the same name is kept: the new one gets a new name. */
  upload(
    accessToken: string,
    file: OneDriveFile,
  ): Promise<Result<{ readonly webUrl: string }, MicrosoftError>>;
}
