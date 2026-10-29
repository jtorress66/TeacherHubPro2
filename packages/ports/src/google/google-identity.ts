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

/** Google sign-in: exchanges an OAuth code for the user's profile. */
export interface GoogleIdentity {
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Result<GoogleProfile, GoogleIdentityError>>;
}
