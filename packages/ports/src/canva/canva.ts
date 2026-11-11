import type { Result } from '@thp/domain';

export interface CanvaError {
  /**
   * `unauthorized`: the teacher's access was revoked or expired; `invalid_file`: Canva could not
   * read the file; `throttled`: too many imports, try again shortly.
   */
  readonly code: 'unauthorized' | 'invalid_file' | 'throttled' | 'unavailable';
}

/** Asks a teacher for access to their Canva account (OAuth with PKCE) and keeps it usable. */
export interface CanvaAuthorization {
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
  }): Promise<Result<{ readonly refreshToken: string }, CanvaError>>;
  /** An access token, and the refresh token that replaces the one just used (each works once). */
  refresh(
    refreshToken: string,
  ): Promise<Result<{ readonly accessToken: string; readonly refreshToken: string }, CanvaError>>;
}

/** A file for Canva to turn into an editable design. */
export interface CanvaFile {
  readonly title: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

/** Imports files into the teacher's Canva account as designs they can edit. */
export interface CanvaDesigns {
  /** Waits for Canva to finish; the edit link works only for the teacher who imported it. */
  importFile(
    accessToken: string,
    file: CanvaFile,
  ): Promise<Result<{ readonly editUrl: string }, CanvaError>>;
}
