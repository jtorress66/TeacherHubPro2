import {
  addDays,
  classAttendanceReport,
  createDateRange,
  localDateIn,
  ok,
  type AttendanceSummary,
  type Class,
  type ClassId,
  type DateRange,
  type Result,
  type Student,
  type User,
} from '@thp/domain';
import type {
  AttendanceSessionRepository,
  ClassRepository,
  Clock,
  StudentRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';

export const defaultReportDays = 30;

export interface AttendanceReportRow {
  readonly student: Student;
  readonly summary: AttendanceSummary;
  readonly rate: number | null;
}

export interface AttendanceReport {
  readonly cls: Class;
  readonly range: DateRange;
  readonly days: number;
  readonly summary: AttendanceSummary;
  readonly rate: number | null;
  readonly rows: readonly AttendanceReportRow[];
}

export interface GetAttendanceReportDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly clock: Clock;
}

/**
 * A class's attendance over a date range (by default the last 30 days, ending today where the
 * teacher is), counting submitted days only, for the students on the roster now.
 */
export class GetAttendanceReport {
  constructor(private readonly deps: GetAttendanceReportDeps) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    from?: string;
    to?: string;
    timeZone: string;
  }): Promise<Result<AttendanceReport, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const today = localDateIn(this.deps.clock.now(), input.timeZone);
    const range = createDateRange(
      input.from ?? addDays(today, 1 - defaultReportDays),
      input.to ?? today,
    );
    if (!range.ok) return range;

    const { schoolId, id } = cls.value;
    const roster = [...(await this.deps.students.listByClass(schoolId, id))].sort(byName);
    const sessions = await this.deps.attendanceSessions.listByClass(schoolId, id, range.value);
    const { students, ...totals } = classAttendanceReport(
      sessions,
      roster.map((student) => student.id),
      range.value,
    );
    const byId = new Map(roster.map((student) => [student.id, student]));
    const rows = students.flatMap(({ studentId, summary, rate }) => {
      const student = byId.get(studentId);
      return student ? [{ student, summary, rate }] : [];
    });
    return ok({ ...totals, cls: cls.value, range: range.value, rows });
  }
}
