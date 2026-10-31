import type { ClassId, SchoolId, StudentId, StudentLinkId } from '../shared/ids.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';

/** How long a link lasts when its class has no semester (or the semester has ended). */
export const linkLifetimeDays = 180;

/**
 * A student's personal link to their class's assignments. Students have no accounts: the link
 * is the key, so only its hash is stored, and it can be revoked and expires.
 */
export interface StudentLink {
  readonly id: StudentLinkId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly studentId: StudentId;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export const createStudentLink = (input: Omit<StudentLink, 'revokedAt'>): StudentLink => ({
  ...input,
  revokedAt: null,
});

export const revokeLink = (link: StudentLink, now: Date): StudentLink => ({
  ...link,
  revokedAt: link.revokedAt ?? now,
});

export const isUsable = (link: StudentLink, now: Date): boolean =>
  link.revokedAt === null && now.getTime() < link.expiresAt.getTime();

/** The day after the semester ends (UTC), or 180 days from now when that is past or unknown. */
export function linkExpiry(semesterEnd: LocalDate | null, now: Date): Date {
  const fallback = new Date(now.getTime() + linkLifetimeDays * 24 * 60 * 60 * 1000);
  if (semesterEnd === null) return fallback;
  const end = new Date(`${addDays(semesterEnd, 1)}T00:00:00Z`);
  return end.getTime() > now.getTime() ? end : fallback;
}
