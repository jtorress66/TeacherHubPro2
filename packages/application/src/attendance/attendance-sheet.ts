import {
  applyMarks,
  ok,
  openAttendanceSession,
  parseLocalDate,
  recordOf,
  reopenAttendance,
  submitAttendance,
  syncRoster,
  type AttendanceError,
  type AttendanceMark,
  type AttendanceSession,
  type AttendanceSessionId,
  type AttendanceStatus,
  type Class,
  type ClassId,
  type LocalDate,
  type Result,
  type SessionStatus,
  type Student,
  type User,
} from '@thp/domain';
import type {
  AttendanceSessionRepository,
  ClassRepository,
  IdGenerator,
  StudentRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';

export type AttendanceUseCaseError = UseCaseError | AttendanceError;

export interface AttendanceDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
}

interface DayInput {
  readonly actor: User;
  readonly classId: ClassId;
  readonly date: string;
}

interface MarksInput extends DayInput {
  readonly marks: readonly AttendanceMark[];
}

export interface SheetRow {
  readonly student: Student;
  readonly status: AttendanceStatus;
  readonly minutesLate: number | null;
  readonly note: string | null;
}

export interface AttendanceSheet {
  readonly cls: Class;
  readonly date: LocalDate;
  /** `new` until the day is first saved. */
  readonly status: SessionStatus | 'new';
  readonly editable: boolean;
  readonly rows: readonly SheetRow[];
}

interface Day {
  readonly cls: Class;
  readonly date: LocalDate;
  readonly roster: readonly Student[];
  /** The saved session, brought in line with today's roster while it is open. */
  readonly session: AttendanceSession | null;
}

/** The class (which the actor must manage), the date, its roster and any saved session. */
async function loadDay(deps: AttendanceDeps, input: DayInput): Promise<Result<Day, UseCaseError>> {
  const cls = await findManagedClass(deps.classes, input.actor, input.classId);
  if (!cls.ok) return cls;
  const date = parseLocalDate('date', input.date);
  if (!date.ok) return date;
  const { schoolId, id } = cls.value;
  const roster = [...(await deps.students.listByClass(schoolId, id))].sort(byName);
  const saved = await deps.attendanceSessions.findByClassAndDate(schoolId, id, date.value);
  const session =
    saved &&
    syncRoster(
      saved,
      roster.map((student) => student.id),
    );
  return ok({ cls: cls.value, date: date.value, roster, session });
}

/** The day's session with the teacher's marks applied, opening it if it was never saved. */
async function markDay(
  deps: AttendanceDeps & { readonly ids: IdGenerator },
  input: MarksInput,
): Promise<Result<AttendanceSession, AttendanceUseCaseError>> {
  const day = await loadDay(deps, input);
  if (!day.ok) return day;
  const { cls, date, roster } = day.value;
  if (cls.archivedAt !== null) return fail('class_archived');
  if (day.value.session) return applyMarks(day.value.session, input.marks);
  const opened = openAttendanceSession({
    id: deps.ids.next() as AttendanceSessionId,
    schoolId: cls.schoolId,
    classId: cls.id,
    date,
    roster: roster.map((student) => student.id),
  });
  if (!opened.ok) return opened;
  return applyMarks(opened.value, input.marks);
}

/** The attendance sheet for a class and day; a new day starts with everyone present. */
export class GetAttendanceSheet {
  constructor(private readonly deps: AttendanceDeps) {}

  async execute(input: DayInput): Promise<Result<AttendanceSheet, UseCaseError>> {
    const day = await loadDay(this.deps, input);
    if (!day.ok) return day;
    const { cls, date, roster, session } = day.value;
    const onSheet = session
      ? roster.filter((student) => session.roster.includes(student.id))
      : roster;
    const rows = onSheet.map((student) => {
      const record = session && recordOf(session, student.id);
      return {
        student,
        status: record?.status ?? 'present',
        minutesLate: record?.minutesLate ?? null,
        note: record?.note ?? null,
      };
    });
    const status = session?.status ?? 'new';
    const editable = status !== 'submitted' && cls.archivedAt === null;
    return ok({ cls, date, status, editable, rows });
  }
}

/** Saves the day's marks; a submitted day refuses changes until it is reopened. */
export class SaveAttendance {
  constructor(private readonly deps: AttendanceDeps & { readonly ids: IdGenerator }) {}

  async execute(input: MarksInput): Promise<Result<AttendanceSession, AttendanceUseCaseError>> {
    const marked = await markDay(this.deps, input);
    if (!marked.ok) return marked;
    await this.deps.attendanceSessions.save(marked.value);
    return marked;
  }
}

/** Saves the day's marks and submits it; nothing is saved unless every student is marked. */
export class SubmitAttendance {
  constructor(private readonly deps: AttendanceDeps & { readonly ids: IdGenerator }) {}

  async execute(input: MarksInput): Promise<Result<AttendanceSession, AttendanceUseCaseError>> {
    const marked = await markDay(this.deps, input);
    if (!marked.ok) return marked;
    const submitted = submitAttendance(marked.value);
    if (!submitted.ok) return submitted;
    await this.deps.attendanceSessions.save(submitted.value);
    return submitted;
  }
}

/** Opens a submitted day again so the teacher can correct it. */
export class ReopenAttendance {
  constructor(private readonly deps: AttendanceDeps) {}

  async execute(input: DayInput): Promise<Result<AttendanceSession, AttendanceUseCaseError>> {
    const day = await loadDay(this.deps, input);
    if (!day.ok) return day;
    if (!day.value.session) return fail('not_found');
    const reopened = reopenAttendance(day.value.session);
    if (!reopened.ok) return reopened;
    await this.deps.attendanceSessions.save(reopened.value);
    return reopened;
  }
}

/** The days taken for a class, latest first. */
export class ListAttendanceDays {
  constructor(private readonly deps: Pick<AttendanceDeps, 'classes' | 'attendanceSessions'>) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
  }): Promise<Result<{ date: LocalDate; status: SessionStatus }[], UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const sessions = await this.deps.attendanceSessions.listByClass(
      cls.value.schoolId,
      cls.value.id,
    );
    return ok(sessions.map(({ date, status }) => ({ date, status })).reverse());
  }
}
