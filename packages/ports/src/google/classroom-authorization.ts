import type { Result } from '@thp/domain';
import type { ClassroomError } from './classroom.ts';

/** Asks a teacher for access to their Google Classroom and keeps it usable. */
export interface ClassroomAuthorization {
  /** Where to send the teacher to grant access; `state` comes back unchanged. */
  authorizationUrl(state: string, redirectUri: string): string;
  /** The long-lived refresh token for a returned code. */
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<Result<{ readonly refreshToken: string }, ClassroomError>>;
  /** A short-lived access token for API calls. */
  accessToken(refreshToken: string): Promise<Result<string, ClassroomError>>;
}
