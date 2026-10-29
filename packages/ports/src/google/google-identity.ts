import type { Email, Result } from '@thp/domain';

export interface GoogleProfile {
  readonly email: Email;
  readonly emailVerified: boolean;
  readonly name: string;
  readonly picture: string | null;
}

export interface GoogleIdentityError {
  readonly code: 'invalid_code' | 'unavailable';
}

/** Google sign-in: sends the user to Google, then exchanges the returned code for their profile. */
export interface GoogleIdentity {
  /** Where to send the browser to sign in; `state` comes back unchanged to prevent forgery. */
  authorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Result<GoogleProfile, GoogleIdentityError>>;
}
