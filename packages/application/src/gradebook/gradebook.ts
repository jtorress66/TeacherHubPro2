import {
  classGradeReport,
  ok,
  type Assignment,
  type AssignmentId,
  type Class,
  type ClassGradeReport,
  type Grade,
  type GradeCategory,
  type Result,
  type Student,
  type StudentGradeSummary,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GradeCategoryRepository,
  GradeRepository,
  StudentRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';
import { classAssignments } from './assignments.ts';
import type { ClassInput } from './gradebook-access.ts';

export interface GradebookDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
}

export interface GradebookRow {
  readonly student: Student;
  readonly grades: Readonly<Partial<Record<AssignmentId, Grade>>>;
  readonly summary: StudentGradeSummary;
}

export interface Gradebook {
  readonly cls: Class;
  readonly editable: boolean;
  readonly categories: readonly GradeCategory[];
  /** The categories' weights added up; the overall rescales when it is not 100. */
  readonly totalWeight: number;
  readonly assignments: readonly Assignment[];
  readonly rows: readonly GradebookRow[];
}

export interface GradebookReport extends Omit<ClassGradeReport, 'students'> {
  readonly cls: Class;
  readonly assignments: number;
  readonly rows: readonly { readonly student: Student; readonly summary: StudentGradeSummary }[];
}

interface ClassGrades {
  readonly cls: Class;
  readonly roster: readonly Student[];
  readonly categories: readonly GradeCategory[];
  readonly assignments: readonly Assignment[];
  readonly report: ClassGradeReport;
  readonly grades: readonly Grade[];
}

/** Everything the gradebook views need for a class the actor manages, read once. */
async function loadClassGrades(
  deps: GradebookDeps,
  input: ClassInput,
): Promise<Result<ClassGrades, UseCaseError>> {
  const cls = await findManagedClass(deps.classes, input.actor, input.classId);
  if (!cls.ok) return cls;
  const { schoolId, id } = cls.value;
  const roster = [...(await deps.students.listByClass(schoolId, id))].sort(byName);
  const categories = await deps.gradeCategories.listByClass(schoolId, id);
  const assignments = await classAssignments(deps.assignments, cls.value);
  const grades = await deps.grades.listByAssignments(
    schoolId,
    assignments.map((a) => a.id),
  );
  const report = classGradeReport(
    categories,
    assignments,
    grades,
    roster.map((student) => student.id),
  );
  return ok({ cls: cls.value, roster, categories, assignments, report, grades });
}

/** Pairs each report row with its student, in roster order. */
const withStudents = ({ roster, report }: ClassGrades) => {
  const byId = new Map(roster.map((student) => [student.id, student]));
  return report.students.flatMap(({ studentId, summary }) => {
    const student = byId.get(studentId);
    return student ? [{ student, summary }] : [];
  });
};

/** The grid: students by assignments, with each student's weighted overall. */
export class GetGradebook {
  constructor(private readonly deps: GradebookDeps) {}

  async execute(input: ClassInput): Promise<Result<Gradebook, UseCaseError>> {
    const loaded = await loadClassGrades(this.deps, input);
    if (!loaded.ok) return loaded;
    const { cls, categories, assignments, grades } = loaded.value;
    const rows = withStudents(loaded.value).map(({ student, summary }) => ({
      student,
      summary,
      grades: Object.fromEntries(
        grades.filter((g) => g.studentId === student.id).map((g) => [g.assignmentId, g]),
      ),
    }));
    return ok({
      cls,
      editable: cls.archivedAt === null,
      categories,
      totalWeight: categories.reduce((sum, c) => sum + c.weightPercent, 0),
      assignments,
      rows,
    });
  }
}

/** Class average, GPA and letter distribution, with each student's result. */
export class GetGradebookReport {
  constructor(private readonly deps: GradebookDeps) {}

  async execute(input: ClassInput): Promise<Result<GradebookReport, UseCaseError>> {
    const loaded = await loadClassGrades(this.deps, input);
    if (!loaded.ok) return loaded;
    const { average, gpa, letter, distribution } = loaded.value.report;
    return ok({
      average,
      gpa,
      letter,
      distribution,
      cls: loaded.value.cls,
      assignments: loaded.value.assignments.length,
      rows: withStudents(loaded.value),
    });
  }
}
