import type { StudentId } from '../shared/ids.ts';
import { compareDates, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import {
  attendanceRate,
  attendanceSummary,
  studentStatuses,
  type AttendanceSummary,
} from './attendance-calculations.ts';
import type { AttendanceSession } from './attendance-session.ts';

/** Both ends included. */
export interface DateRange {
  readonly from: LocalDate;
  readonly to: LocalDate;
}

export function createDateRange(from: string, to: string): Result<DateRange, ValidationError> {
  const start = parseLocalDate('from', from);
  if (!start.ok) return start;
  const end = parseLocalDate('to', to);
  if (!end.ok) return end;
  if (compareDates(start.value, end.value) > 0) return invalid('to', 'invalid_order');
  return ok({ from: start.value, to: end.value });
}

export const inRange = (date: LocalDate, range: DateRange): boolean =>
  compareDates(date, range.from) >= 0 && compareDates(date, range.to) <= 0;

export interface StudentAttendance {
  readonly studentId: StudentId;
  readonly summary: AttendanceSummary;
  readonly rate: number | null;
}

export interface ClassAttendanceReport {
  readonly students: readonly StudentAttendance[];
  /** Every listed student's days added together. */
  readonly summary: AttendanceSummary;
  readonly rate: number | null;
  /** Submitted days in the range. */
  readonly days: number;
}

/**
 * Attendance per student over the submitted days in a range. Each student's total is the days
 * they were on that day's roster, so a student who joined later is not counted absent before.
 */
export function classAttendanceReport(
  sessions: readonly AttendanceSession[],
  studentIds: readonly StudentId[],
  range: DateRange,
): ClassAttendanceReport {
  const counted = sessions.filter(
    (session) => session.status === 'submitted' && inRange(session.date, range),
  );
  const perStudent = studentIds.map((studentId) => ({
    studentId,
    statuses: studentStatuses(counted, studentId),
  }));
  const students = perStudent.map(({ studentId, statuses }) => {
    const summary = attendanceSummary(statuses);
    return { studentId, summary, rate: attendanceRate(summary) };
  });
  const summary = attendanceSummary(perStudent.flatMap(({ statuses }) => statuses));
  return { students, summary, rate: attendanceRate(summary), days: counted.length };
}
