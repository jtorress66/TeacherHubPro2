import type { Grade } from '../gradebook/grade.ts';
import type { PlannedWeek } from '../lesson-plans/plan-standards.ts';
import type { AssignmentId, StudentId } from '../shared/ids.ts';
import { compareDates, type LocalDate } from '../shared/local-date.ts';
import { describeStandard, type StandardInfo } from './standard-info.ts';

/** A class average at or above this is on track. */
export const onTrackPercent = 80;
/** A class average at or above this (and below on track) is worth watching; below it, reteach. */
export const watchPercent = 70;

/** Most urgent first. */
export const coverageStatuses = ['reteach', 'watch', 'on_track', 'not_tested'] as const;
export type CoverageStatus = (typeof coverageStatuses)[number];

/** The parts of an assignment the report reads. */
export interface CoverageAssignment {
  readonly id: AssignmentId;
  readonly points: number;
  readonly standards: readonly string[];
}

export type CoverageGrade = Pick<Grade, 'studentId' | 'assignmentId' | 'status' | 'score'>;

export interface CoverageInput {
  readonly plannedWeeks: readonly PlannedWeek[];
  readonly assignments: readonly CoverageAssignment[];
  /** Teacher-confirmed grades only: AI drafts are never Grades. */
  readonly grades: readonly CoverageGrade[];
  /** The class's current roster; grades of students no longer in it are left out. */
  readonly studentIds: readonly StudentId[];
}

/** How one standard is going in a class: counts only, no student names. */
export interface StandardCoverage {
  readonly standard: StandardInfo;
  readonly plannedWeeks: readonly LocalDate[];
  readonly assignments: number;
  /** The class average, in whole percent, of the students with a score; null when none. */
  readonly average: number | null;
  readonly studentsScored: number;
  readonly studentsBelow: number;
  readonly status: CoverageStatus;
}

const scored = (grade: CoverageGrade): grade is CoverageGrade & { score: number } =>
  (grade.status === 'graded' || grade.status === 'late') && grade.score !== null;

export function coverageStatusFor(average: number | null): CoverageStatus {
  if (average === null) return 'not_tested';
  if (average >= onTrackPercent) return 'on_track';
  return average >= watchPercent ? 'watch' : 'reteach';
}

/** Each student's whole percent over the given assignments, for students with a score. */
function studentPercents(
  assignments: readonly CoverageAssignment[],
  grades: readonly CoverageGrade[],
  roster: ReadonlySet<StudentId>,
): number[] {
  const points = new Map(assignments.map((a) => [a.id, a.points]));
  const totals = new Map<StudentId, { earned: number; possible: number }>();
  for (const grade of grades) {
    const possible = points.get(grade.assignmentId);
    if (possible === undefined || !roster.has(grade.studentId) || !scored(grade)) continue;
    const total = totals.get(grade.studentId) ?? { earned: 0, possible: 0 };
    totals.set(grade.studentId, {
      earned: total.earned + grade.score,
      possible: total.possible + possible,
    });
  }
  return [...totals.values()]
    .filter((total) => total.possible > 0)
    .map((total) => Math.round((total.earned / total.possible) * 100));
}

function orderedCodes(input: CoverageInput): string[] {
  const weeks = [...input.plannedWeeks].sort((a, b) => compareDates(a.weekStart, b.weekStart));
  const planned = weeks.flatMap((week) => week.codes);
  const tested = input.assignments.flatMap((assignment) => assignment.standards);
  return [...new Set([...planned, ...tested])];
}

/**
 * Per standard a class planned or tested: the weeks it was planned, how many assignments test
 * it, and how the class did on them. Codes come in plan order, then those only assignments test.
 */
export function standardsCoverage(input: CoverageInput): StandardCoverage[] {
  const roster = new Set(input.studentIds);
  return orderedCodes(input).map((code) => {
    const testing = input.assignments.filter((a) => a.standards.includes(code));
    const percents = studentPercents(testing, input.grades, roster);
    const average =
      percents.length === 0
        ? null
        : Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);
    const weeks = input.plannedWeeks
      .filter((week) => week.codes.includes(code))
      .map((week) => week.weekStart);
    return {
      standard: describeStandard(code),
      plannedWeeks: [...new Set(weeks)].sort(compareDates),
      assignments: testing.length,
      average,
      studentsScored: percents.length,
      studentsBelow: percents.filter((p) => p < watchPercent).length,
      status: coverageStatusFor(average),
    };
  });
}

/** How many standards are in each status. */
export function summarizeCoverage(
  rows: readonly StandardCoverage[],
): Record<CoverageStatus, number> {
  const counts = { reteach: 0, watch: 0, on_track: 0, not_tested: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
