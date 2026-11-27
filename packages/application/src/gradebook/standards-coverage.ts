import {
  ok,
  planStandardWeeks,
  standardsCoverage,
  standardsOf,
  summarizeCoverage,
  type Class,
  type ClassId,
  type CoverageStatus,
  type Result,
  type StandardCoverage,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GameRepository,
  GradeRepository,
  LessonPlanRepository,
  StudentRepository,
} from '@thp/ports';
import { mayManageSchool, type SchoolAccessDeps } from '../admin/school-access.ts';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { ClassInput } from './gradebook-access.ts';

export interface StandardsCoverageDeps {
  readonly classes: ClassRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly students: StudentRepository;
  readonly games: GameRepository;
}

export type CoverageSummary = Record<CoverageStatus, number>;

export interface ClassStandardsCoverage {
  readonly rows: readonly StandardCoverage[];
  readonly summary: CoverageSummary;
}

/**
 * Reads one class's plans, tagged assignments, confirmed grades and shared games into the
 * coverage report.
 */
async function coverageOf(
  deps: StandardsCoverageDeps,
  cls: Class,
): Promise<ClassStandardsCoverage> {
  const [plans, assignments, students, games] = await Promise.all([
    deps.lessonPlans.listByClass(cls.schoolId, cls.id),
    deps.assignments.listByClass(cls.schoolId, cls.id),
    deps.students.listByClass(cls.schoolId, cls.id),
    deps.games.listByClass(cls.schoolId, cls.id),
  ]);
  const tagged = assignments.filter((assignment) => assignment.standards.length > 0);
  const grades =
    tagged.length === 0
      ? []
      : await deps.grades.listByAssignments(
          cls.schoolId,
          tagged.map((assignment) => assignment.id),
        );
  const rows = standardsCoverage({
    plannedWeeks: plans.flatMap((plan) => planStandardWeeks(plan.body)),
    assignments: tagged,
    grades,
    studentIds: students.map((student) => student.id),
    games: games.map((game) => ({ standards: standardsOf(game.content) })),
  });
  return { rows, summary: summarizeCoverage(rows) };
}

/** How each standard a class planned or tested is going; for its teacher or a school admin. */
export class GetStandardsCoverage {
  constructor(private readonly deps: StandardsCoverageDeps) {}

  async execute(input: ClassInput): Promise<Result<ClassStandardsCoverage, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    return ok(await coverageOf(this.deps, cls.value));
  }
}

export interface ClassCoverageSummary {
  readonly classId: ClassId;
  readonly name: string;
  readonly summary: CoverageSummary;
}

/** For the school's admins: each active class's standards counted by status. */
export class GetSchoolStandardsCoverage {
  constructor(private readonly deps: StandardsCoverageDeps & SchoolAccessDeps) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<{ readonly classes: readonly ClassCoverageSummary[] }, UseCaseError>> {
    const { actor } = input;
    if (!(await mayManageSchool(this.deps, actor))) return fail('forbidden');
    const classes = await this.deps.classes.listBySchool(actor.schoolId);
    const reports = await Promise.all(
      classes.map(async (cls) => ({ cls, report: await coverageOf(this.deps, cls) })),
    );
    return ok({
      classes: reports
        .filter(({ report }) => report.rows.length > 0)
        .map(({ cls, report }) => ({ classId: cls.id, name: cls.name, summary: report.summary })),
    });
  }
}
