import type { Result } from '@thp/domain';

export interface MicrosoftError {
  /**
   * `unauthorized`: the teacher's access was revoked or expired; `throttled`: too many requests,
   * try again shortly; `unavailable`: Microsoft could not be reached or answered unexpectedly;
   * `insufficient_scope`: the grant lacks a permission the call needs (e.g. Teams was never
   * allowed, or was withdrawn); `not_found`: the class or item is not the teacher's or is gone.
   * When asking for consent: `admin_approval_required`: the school's administrator must approve
   * the app first; `school_account_required`: the permission needs a work or school account;
   * `declined`: the teacher (or Microsoft, for them) did not grant it.
   */
  readonly code:
    | 'unauthorized'
    | 'throttled'
    | 'unavailable'
    | 'insufficient_scope'
    | 'not_found'
    | 'admin_approval_required'
    | 'school_account_required'
    | 'declined';
}

/**
 * Which permissions a grant covers: always OneDrive (signing in, staying connected, the teacher's
 * own files); with `teams`, also Teams class rosters and assignments (school accounts only).
 */
export interface MicrosoftGrantScope {
  readonly teams: boolean;
}

/**
 * Asks a teacher for access to their Microsoft account (OAuth with PKCE) and keeps it usable.
 * Microsoft has no way for an app to revoke its own delegated grant, so there is no revoke:
 * disconnecting forgets the token, and the teacher can remove the app in their account.
 */
export interface MicrosoftAuthorization {
  /** Where to send the teacher to grant access; `state` comes back unchanged. */
  authorizationUrl(
    input: {
      readonly state: string;
      readonly codeChallenge: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): string;
  /** The refresh token, and whether Teams was actually granted (asked for and allowed). */
  exchangeCode(
    input: {
      readonly code: string;
      readonly codeVerifier: string;
      readonly redirectUri: string;
    } & MicrosoftGrantScope,
  ): Promise<Result<{ readonly refreshToken: string; readonly teams: boolean }, MicrosoftError>>;
  /**
   * An access token for what the grant covers, and the refresh token to keep: a new one when
   * Microsoft issued one, otherwise the one just used. `insufficient_scope` when Teams is asked
   * for but no longer granted.
   */
  refresh(
    refreshToken: string,
    scope: MicrosoftGrantScope,
  ): Promise<
    Result<{ readonly accessToken: string; readonly refreshToken: string }, MicrosoftError>
  >;
  /** What a refusal sent back instead of a code (`error`, `error_description`) means. */
  refusal(response: {
    readonly error: string;
    readonly description: string | null;
  }): MicrosoftError;
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
