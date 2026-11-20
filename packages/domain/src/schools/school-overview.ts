import type { SchoolId, UserId } from '../shared/ids.ts';
import { isAdminOf, type Role } from '../users/roles.ts';
import type { School, SchoolFeatures } from './school.ts';

export const setSchoolFeatures = (school: School, features: SchoolFeatures): School => ({
  ...school,
  features,
});

/** Who may see the school's overview and change its switches: its admins and the account owner. */
export function canManageSchool(
  actor: { readonly id: UserId; readonly schoolId: SchoolId; readonly role: Role },
  subscription: { readonly ownerId: UserId } | null,
): boolean {
  return isAdminOf(actor, actor.schoolId) || subscription?.ownerId === actor.id;
}

/** How far back the overview counts. */
export const usageWindowDays = 30;

export const usageSince = (now: Date): Date =>
  new Date(now.getTime() - usageWindowDays * 24 * 60 * 60 * 1000);

/** One teacher's use of the app: counts only, from records the app already keeps. */
export interface TeacherUsage {
  readonly teacherId: UserId;
  readonly name: string;
  /** When they last used the app; null when never seen. */
  readonly lastActiveAt: Date | null;
  readonly classes: number;
  readonly students: number;
  /** AI drafts started in the window. */
  readonly aiDrafts: number;
  /** Attendance days taken in the window. */
  readonly attendanceDays: number;
  /** Assignments made in the window. */
  readonly assignments: number;
}

export interface UsageTotals {
  readonly teachers: number;
  readonly activeTeachers: number;
  readonly students: number;
  readonly aiDrafts: number;
  readonly attendanceDays: number;
}

export function summarizeUsage(rows: readonly TeacherUsage[], now: Date): UsageTotals {
  const since = usageSince(now);
  const sum = (pick: (row: TeacherUsage) => number) => rows.reduce((n, row) => n + pick(row), 0);
  return {
    teachers: rows.length,
    activeTeachers: rows.filter((row) => row.lastActiveAt !== null && row.lastActiveAt >= since)
      .length,
    students: sum((row) => row.students),
    aiDrafts: sum((row) => row.aiDrafts),
    attendanceDays: sum((row) => row.attendanceDays),
  };
}
