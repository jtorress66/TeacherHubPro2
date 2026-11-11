import type { SchoolId, UserId } from '../shared/ids.ts';

/**
 * A teacher's link to their Canva account. Only the encrypted refresh token is kept; Canva
 * replaces it at every use, so the newest one is saved each time.
 */
export interface CanvaConnection {
  /** One connection per teacher, so the teacher's id. */
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly encryptedRefreshToken: string;
  readonly connectedAt: Date;
}

export const connectCanva = (input: Omit<CanvaConnection, 'id'>): CanvaConnection => ({
  id: input.teacherId,
  ...input,
});

/** Canva accepts design titles of up to 50 characters. */
export const maxCanvaTitleLength = 50;

/**
 * A design title Canva accepts: trimmed, at most 50 characters (UTF-16 units, as JavaScript
 * counts them), cut between whole letters and emoji, never empty.
 */
export function canvaTitle(name: string): string {
  let title = '';
  for (const { segment } of new Intl.Segmenter().segment(name.trim())) {
    if (title.length + segment.length > maxCanvaTitleLength) break;
    title += segment;
  }
  title = title.trim();
  return title === '' ? 'TeacherHubPro' : title;
}
