import {
  createStudent,
  err,
  ok,
  type Class,
  type ClassId,
  type Result,
  type Student,
  type StudentId,
  type User,
  type ValidationCode,
} from '@thp/domain';
import type { ClassRepository, IdGenerator, StudentRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { CsvTableError } from '../shared/csv-table.ts';
import { parseRosterCsv, type RosterRow } from './roster-csv.ts';

export interface RowError {
  readonly line: number;
  readonly field: string;
  readonly code: ValidationCode;
}

export type ImportError =
  | UseCaseError
  | CsvTableError<string>
  | { readonly code: 'invalid_rows'; readonly rows: readonly RowError[] };

export interface ImportStudentsDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly ids: IdGenerator;
}

/**
 * Adds a whole roster from a CSV file, all or nothing: if any row breaks a rule, nothing is
 * imported and every bad row is reported with its line, so the teacher can fix the file.
 */
export class ImportStudents {
  private readonly roster: RosterImporter;

  constructor(private readonly deps: ImportStudentsDeps) {
    this.roster = new RosterImporter(deps);
  }

  async execute(input: {
    actor: User;
    classId: ClassId;
    csv: string;
  }): Promise<Result<{ imported: number }, ImportError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    return this.roster.importInto(cls.value, input.csv);
  }
}

/** Imports a roster file into a class the caller has already checked access to. */
export class RosterImporter {
  constructor(private readonly deps: Omit<ImportStudentsDeps, 'classes'>) {}

  async importInto(cls: Class, csv: string): Promise<Result<{ imported: number }, ImportError>> {
    if (cls.archivedAt !== null) return fail('class_archived');
    const rows = parseRosterCsv(csv);
    if (!rows.ok) return rows;

    const existing = await this.deps.students.listByClass(cls.schoolId, cls.id);
    const taken = new Set(existing.flatMap((student) => student.studentNumber ?? []));
    const students: Student[] = [];
    const errors: RowError[] = [];
    for (const row of rows.value) {
      const student = this.toStudent(row, cls.schoolId, cls.id);
      if (!student.ok) {
        errors.push({ line: row.line, ...student.error });
        continue;
      }
      const number = student.value.studentNumber;
      if (number !== null && taken.has(number)) {
        errors.push({ line: row.line, field: 'studentNumber', code: 'duplicate' });
        continue;
      }
      if (number !== null) taken.add(number);
      students.push(student.value);
    }
    if (errors.length > 0) return err({ code: 'invalid_rows', rows: errors });

    await this.deps.students.saveMany(students);
    return ok({ imported: students.length });
  }

  private toStudent(row: RosterRow, schoolId: Student['schoolId'], classId: ClassId) {
    return createStudent({
      id: this.deps.ids.next() as StudentId,
      schoolId,
      classId,
      firstName: row.firstName,
      lastName: row.lastName,
      studentNumber: row.studentNumber,
      parentEmail: row.parentEmail,
      accommodations: row.accommodations,
    });
  }
}
