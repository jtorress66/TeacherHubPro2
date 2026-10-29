import type { StudentId } from '../shared/ids.ts';
import { statusOf, type AttendanceSession, type AttendanceStatus } from './attendance-session.ts';

export interface AttendanceSummary {
  readonly present: number;
  readonly absent: number;
  readonly tardy: number;
  readonly excused: number;
  readonly total: number;
}

export function attendanceSummary(statuses: readonly AttendanceStatus[]): AttendanceSummary {
  const counts = { present: 0, absent: 0, tardy: 0, excused: 0 };
  for (const status of statuses) counts[status] += 1;
  return { ...counts, total: statuses.length };
}

/** (present + tardy) / total, as a percentage. Excused days count in the total. Null with no sessions. */
export function attendanceRate(summary: AttendanceSummary): number | null {
  if (summary.total === 0) return null;
  return ((summary.present + summary.tardy) / summary.total) * 100;
}

/** A student's statuses across sessions, counting submitted sessions only. */
export function studentStatuses(
  sessions: readonly AttendanceSession[],
  studentId: StudentId,
): AttendanceStatus[] {
  return sessions
    .filter((session) => session.status === 'submitted')
    .flatMap((session) => {
      const status = statusOf(session, studentId);
      return status === null ? [] : [status];
    });
}
