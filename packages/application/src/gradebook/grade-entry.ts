import {
  createGrade,
  err,
  maxPoints,
  ok,
  type Assignment,
  type Grade,
  type GradeId,
  type GradeStatus,
  type Result,
  type Student,
  type StudentId,
  type ValidationCode,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GradeRepository,
  IdGenerator,
  StudentRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';
import { findClassAssignment, type AssignmentInput } from './assignments.ts';
import { findEditableClass } from './gradebook-access.ts';

export interface GradeEntryDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
}

export interface GradeEntryRow {
  readonly student: Student;
  readonly grade: Grade | null;
}

export interface GradeEntry {
  readonly assignment: Assignment;
  readonly maxPoints: number;
  readonly editable: boolean;
  readonly rows: readonly GradeEntryRow[];
}

export interface GradeRowInput {
  readonly studentId: StudentId;
  readonly status: GradeStatus;
  readonly score?: number | null;
  readonly comment?: string | null;
}

/** Every bad row, keyed by student, so the teacher can fix them all at once. */
export interface InvalidGrades {
  readonly code: 'invalid_grades';
  readonly rows: Readonly<Record<string, ValidationCode>>;
}

export type GradeEntryError = UseCaseError | InvalidGrades;

/** One assignment's column: every student in the class, in name order, with any saved grade. */
export class GetGradeEntry {
  constructor(private readonly deps: GradeEntryDeps) {}

  async execute(input: AssignmentInput): Promise<Result<GradeEntry, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const assignment = await findClassAssignment(
      this.deps.assignments,
      cls.value,
      input.assignmentId,
    );
    if (!assignment.ok) return assignment;
    const { schoolId, id } = cls.value;
    const roster = [...(await this.deps.students.listByClass(schoolId, id))].sort(byName);
    const grades = await this.deps.grades.listByAssignment(schoolId, assignment.value.id);
    const byStudent = new Map(grades.map((grade) => [grade.studentId, grade]));
    return ok({
      assignment: assignment.value,
      maxPoints: maxPoints(assignment.value),
      editable: cls.value.archivedAt === null,
      rows: roster.map((student) => ({ student, grade: byStudent.get(student.id) ?? null })),
    });
  }
}

/**
 * Saves a column of grades as the teacher's own (manual) decisions. A student's existing grade
 * keeps its id; nothing is saved unless every row is valid.
 */
export class SaveGrades {
  constructor(private readonly deps: GradeEntryDeps & { readonly ids: IdGenerator }) {}

  async execute(
    input: AssignmentInput & { rows: readonly GradeRowInput[] },
  ): Promise<Result<readonly Grade[], GradeEntryError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const assignment = await findClassAssignment(
      this.deps.assignments,
      cls.value,
      input.assignmentId,
    );
    if (!assignment.ok) return assignment;
    const { schoolId, id } = cls.value;
    const roster = new Set((await this.deps.students.listByClass(schoolId, id)).map((s) => s.id));
    const saved = new Map(
      (await this.deps.grades.listByAssignment(schoolId, assignment.value.id)).map((grade) => [
        grade.studentId,
        grade.id,
      ]),
    );

    const grades: Grade[] = [];
    const problems: Record<string, ValidationCode> = {};
    for (const row of input.rows) {
      if (!roster.has(row.studentId)) {
        problems[row.studentId] = 'not_allowed';
        continue;
      }
      const grade = createGrade({
        id: saved.get(row.studentId) ?? (this.deps.ids.next() as GradeId),
        schoolId,
        studentId: row.studentId,
        assignmentId: assignment.value.id,
        status: row.status,
        score: row.score ?? null,
        maxPoints: maxPoints(assignment.value),
        source: 'manual',
        gradedBy: input.actor.id,
        comment: row.comment ?? null,
      });
      if (grade.ok) grades.push(grade.value);
      else problems[row.studentId] = grade.error.code;
    }
    if (Object.keys(problems).length > 0) return err({ code: 'invalid_grades', rows: problems });

    for (const grade of grades) await this.deps.grades.save(grade);
    return ok(grades);
  }
}
