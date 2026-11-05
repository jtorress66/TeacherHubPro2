import { attendanceSummary } from '../attendance/attendance-calculations.ts';
import type { AttendanceStatus } from '../attendance/attendance-session.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { WeightedCategory } from '../gradebook/grade-calculations.ts';
import type { Grade } from '../gradebook/grade.ts';
import { studentGradeSummary } from '../gradebook/student-grades.ts';
import type { LocalDate } from '../shared/local-date.ts';

export const riskKinds = [
  'failing',
  'low',
  'missing',
  'high_absences',
  'absences',
  'tardies',
] as const;

export type RiskKind = (typeof riskKinds)[number];

/** One reason a student may need help, with its number (an average, or a count). */
export interface RiskFactor {
  readonly kind: RiskKind;
  readonly value: number;
}

export interface Risk {
  readonly score: number;
  readonly factors: readonly RiskFactor[];
}

export interface RiskInput {
  readonly categories: readonly WeightedCategory[];
  readonly assignments: readonly Assignment[];
  /** This student's grades. */
  readonly grades: readonly Grade[];
  /** This student's attendance in the window that counts (the last 30 days). */
  readonly statuses: readonly AttendanceStatus[];
  readonly today: LocalDate;
}

/** A student flagged at this score or more. */
export const atRiskScore = 2;
const maxListed = 10;

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/**
 * Work the student has not handed in: marked missing, or past its due date with no grade (and
 * not excused). Work not yet due is never missing.
 */
export function missingAssignments(
  assignments: readonly Assignment[],
  grades: readonly Grade[],
  today: LocalDate,
): Assignment[] {
  const gradeOf = new Map(grades.map((grade) => [grade.assignmentId, grade]));
  return assignments.filter((assignment) => {
    const grade = gradeOf.get(assignment.id);
    if (grade !== undefined) return grade.status === 'missing';
    return assignment.dueDate !== null && assignment.dueDate < today;
  });
}

/** Each rule adds points when it applies; a new rule is a new entry. */
type Rule = (facts: {
  readonly average: number | null;
  readonly missing: number;
  readonly sessions: number;
  readonly absent: number;
  readonly tardy: number;
}) => (RiskFactor & { readonly points: number }) | null;

const rules: readonly Rule[] = [
  ({ average }) => {
    if (average === null || average >= 70) return null;
    return average < 60
      ? { kind: 'failing', value: oneDecimal(average), points: 3 }
      : { kind: 'low', value: oneDecimal(average), points: 2 };
  },
  ({ missing }) =>
    missing === 0 ? null : { kind: 'missing', value: missing, points: missing >= 3 ? 2 : 1 },
  ({ sessions, absent }) => {
    if (sessions === 0) return null;
    if (absent / sessions >= 0.2) return { kind: 'high_absences', value: absent, points: 3 };
    return absent >= 3 ? { kind: 'absences', value: absent, points: 1 } : null;
  },
  ({ tardy }) => (tardy >= 5 ? { kind: 'tardies', value: tardy, points: 1 } : null),
];

/**
 * How much help a student may need: a low weighted average (on each assignment's real points),
 * missing work, absences and tardies add points.
 */
export function riskOf(input: RiskInput): Risk {
  const summary = attendanceSummary(input.statuses);
  const facts = {
    average: studentGradeSummary(input.categories, input.assignments, input.grades).overall,
    missing: missingAssignments(input.assignments, input.grades, input.today).length,
    sessions: input.statuses.length,
    absent: summary.absent,
    tardy: summary.tardy,
  };
  const applied = rules.flatMap((rule) => rule(facts) ?? []);
  return {
    score: applied.reduce((sum, factor) => sum + factor.points, 0),
    factors: applied.map(({ kind, value }) => ({ kind, value })),
  };
}

/** Students at or above the at-risk score, highest first, at most ten. */
export function atRiskList<T extends { readonly risk: Risk }>(rows: readonly T[]): T[] {
  return rows
    .filter((row) => row.risk.score >= atRiskScore)
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, maxListed);
}
