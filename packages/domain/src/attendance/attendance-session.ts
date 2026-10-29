import type { AttendanceSessionId, ClassId, SchoolId, StudentId } from '../shared/ids.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

export const attendanceStatuses = ['present', 'absent', 'tardy', 'excused'] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const sessionStatuses = ['open', 'submitted'] as const;

export type SessionStatus = (typeof sessionStatuses)[number];

export type SessionAction = 'mark' | 'submit' | 'reopen';

export type AttendanceError =
  | InvalidTransition<SessionStatus, SessionAction>
  | { readonly code: 'not_in_roster'; readonly studentId: StudentId }
  | { readonly code: 'incomplete'; readonly unmarked: readonly StudentId[] };

export interface AttendanceRecord {
  readonly studentId: StudentId;
  readonly status: AttendanceStatus;
}

export interface AttendanceSession {
  readonly id: AttendanceSessionId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly date: LocalDate;
  readonly status: SessionStatus;
  readonly roster: readonly StudentId[];
  readonly records: readonly AttendanceRecord[];
}

export interface AttendanceSessionInput {
  readonly id: AttendanceSessionId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly date: string;
  readonly roster: readonly StudentId[];
}

const transitions: TransitionTable<SessionStatus, SessionAction> = {
  mark: ['open'],
  submit: ['open'],
  reopen: ['submitted'],
};

export function openAttendanceSession(
  input: AttendanceSessionInput,
): Result<AttendanceSession, ValidationError> {
  const date = parseLocalDate('date', input.date);
  if (!date.ok) return date;
  if (new Set(input.roster).size !== input.roster.length) return invalid('roster', 'duplicate');
  return ok({ ...input, date: date.value, status: 'open', records: [] });
}

export function statusOf(
  session: AttendanceSession,
  studentId: StudentId,
): AttendanceStatus | null {
  return session.records.find((record) => record.studentId === studentId)?.status ?? null;
}

export function markAttendance(
  session: AttendanceSession,
  studentId: StudentId,
  status: AttendanceStatus,
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'mark');
  if (!allowed.ok) return allowed;
  if (!session.roster.includes(studentId)) return err({ code: 'not_in_roster', studentId });
  const others = session.records.filter((record) => record.studentId !== studentId);
  return ok({ ...session, records: [...others, { studentId, status }] });
}

export function submitAttendance(
  session: AttendanceSession,
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'submit');
  if (!allowed.ok) return allowed;
  const unmarked = session.roster.filter((studentId) => statusOf(session, studentId) === null);
  if (unmarked.length > 0) return err({ code: 'incomplete', unmarked });
  return ok({ ...session, status: 'submitted' });
}

/** Lets the teacher correct a submitted session. */
export function reopenAttendance(
  session: AttendanceSession,
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'reopen');
  if (!allowed.ok) return allowed;
  return ok({ ...session, status: 'open' });
}
