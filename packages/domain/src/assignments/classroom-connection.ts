import type { SchoolId, UserId } from '../shared/ids.ts';

/**
 * A teacher's link to Google Classroom. Only the encrypted refresh token is kept; access tokens
 * are fetched when needed and never stored.
 */
export interface ClassroomConnection {
  /** One connection per teacher, so the teacher's id. */
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly encryptedRefreshToken: string;
  readonly connectedAt: Date;
}

export const connectClassroom = (input: Omit<ClassroomConnection, 'id'>): ClassroomConnection => ({
  id: input.teacherId,
  ...input,
});
