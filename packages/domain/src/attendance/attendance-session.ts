import type { AttendanceSessionId, ClassId, SchoolId, StudentId } from '../shared/ids.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';

export const attendanceStatuses = ['present', 'absent', 'tardy', 'excused'] as const;

export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const sessionStatuses = ['open', 'submitted'] as const;

export type SessionStatus = (typeof sessionStatuses)[number];

export type SessionAction = 'mark' | 'submit' | 'reopen';

export type AttendanceError =
  | InvalidTransition<SessionStatus, SessionAction>
  | { readonly code: 'not_in_roster'; readonly studentId: StudentId }
  | { readonly code: 'incomplete'; readonly unmarked: readonly StudentId[] }
  | ValidationError;

export interface AttendanceRecord {
  readonly studentId: StudentId;
  readonly status: AttendanceStatus;
  /** How late a tardy student arrived; only ever set on a tardy. */
  readonly minutesLate: number | null;
  readonly note: string | null;
}

export interface AttendanceDetails {
  readonly minutesLate?: number | null;
  readonly note?: string | null;
}

/** One student's mark as the teacher entered it. */
export interface AttendanceMark extends AttendanceDetails {
  readonly studentId: StudentId;
  readonly status: AttendanceStatus;
}

export const maxMinutesLate = 240;
export const maxNoteLength = 200;

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

export function recordOf(
  session: AttendanceSession,
  studentId: StudentId,
): AttendanceRecord | null {
  return session.records.find((record) => record.studentId === studentId) ?? null;
}

export function statusOf(
  session: AttendanceSession,
  studentId: StudentId,
): AttendanceStatus | null {
  return recordOf(session, studentId)?.status ?? null;
}

function minutesLateFor(
  status: AttendanceStatus,
  minutesLate: number | null | undefined,
): Result<number | null, ValidationError> {
  if (minutesLate === null || minutesLate === undefined) return ok(null);
  if (status !== 'tardy') return invalid('minutesLate', 'not_allowed');
  const valid = Number.isInteger(minutesLate) && minutesLate >= 1 && minutesLate <= maxMinutesLate;
  return valid ? ok(minutesLate) : invalid('minutesLate', 'out_of_range');
}

export function markAttendance(
  session: AttendanceSession,
  studentId: StudentId,
  status: AttendanceStatus,
  details: AttendanceDetails = {},
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'mark');
  if (!allowed.ok) return allowed;
  if (!session.roster.includes(studentId)) return err({ code: 'not_in_roster', studentId });
  const minutesLate = minutesLateFor(status, details.minutesLate);
  if (!minutesLate.ok) return minutesLate;
  const note = optionalText('note', details.note, maxNoteLength);
  if (!note.ok) return note;
  const record = { studentId, status, minutesLate: minutesLate.value, note: note.value };
  const others = session.records.filter((other) => other.studentId !== studentId);
  return ok({ ...session, records: [...others, record] });
}

/** Applies the teacher's marks in order; a submitted session refuses them all. */
export function applyMarks(
  session: AttendanceSession,
  marks: readonly AttendanceMark[],
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'mark');
  if (!allowed.ok) return allowed;
  let marked = session;
  for (const { studentId, status, ...details } of marks) {
    const next = markAttendance(marked, studentId, status, details);
    if (!next.ok) return next;
    marked = next.value;
  }
  return ok(marked);
}

/** Gives every rostered student the same status, clearing earlier details ("Mark all present"). */
export function markAll(
  session: AttendanceSession,
  status: AttendanceStatus,
): Result<AttendanceSession, AttendanceError> {
  const allowed = guardTransition(transitions, session.status, 'mark');
  if (!allowed.ok) return allowed;
  const records = session.roster.map((studentId) => ({
    studentId,
    status,
    minutesLate: null,
    note: null,
  }));
  return ok({ ...session, records });
}

/**
 * Brings an open session in line with the class's current roster: new students join it and
 * removed students' marks drop. A submitted session stays as it was taken.
 */
export function syncRoster(
  session: AttendanceSession,
  roster: readonly StudentId[],
): AttendanceSession {
  if (session.status === 'submitted') return session;
  const records = session.records.filter((record) => roster.includes(record.studentId));
  return { ...session, roster: [...roster], records };
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
