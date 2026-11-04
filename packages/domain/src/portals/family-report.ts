import {
  attendanceRate,
  attendanceSummary,
  type AttendanceSummary,
} from '../attendance/attendance-calculations.ts';
import {
  statusOf,
  type AttendanceSession,
  type AttendanceStatus,
} from '../attendance/attendance-session.ts';
import type { GamePlay } from '../games/game-play.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { WeightedCategory } from '../gradebook/grade-calculations.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import { studentGradeSummary } from '../gradebook/student-grades.ts';
import type { LearningPath } from '../learning/learning-path.ts';
import { studentLearningProgress, type SubjectProgress } from '../learning/learning-progress.ts';
import type { LessonAttempt } from '../learning/lesson-attempt.ts';
import type { StudentId } from '../shared/ids.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';

/** Grades a family may see: the teacher's own entries. Pending work shows as not graded. */
const shownStatuses: readonly GradeStatus[] = ['graded', 'late', 'missing', 'excused'];
const scoredStatuses: readonly GradeStatus[] = ['graded', 'late'];
const upcomingDays = 7;
const recentDays = 10;

export type FamilyGradeStatus = Exclude<GradeStatus, 'pending'> | 'not_graded';

export interface FamilyAssignment {
  readonly title: string;
  readonly dueDate: LocalDate | null;
  readonly points: number;
  readonly status: FamilyGradeStatus;
  /** Only for graded and late work. */
  readonly score: number | null;
}

export interface FamilyReport {
  /** The class's weighted average over confirmed grades, rounded, or null before any. */
  readonly overall: number | null;
  readonly assignments: readonly FamilyAssignment[];
  readonly upcoming: readonly { readonly title: string; readonly dueDate: LocalDate }[];
  readonly attendance: {
    readonly summary: AttendanceSummary;
    readonly rate: number | null;
    readonly recent: readonly { readonly date: LocalDate; readonly status: AttendanceStatus }[];
  };
  readonly learning: readonly SubjectProgress[];
  readonly games: {
    readonly plays: number;
    readonly best: number | null;
    readonly average: number | null;
  };
}

export interface FamilyReportInput {
  readonly studentId: StudentId;
  readonly today: LocalDate;
  readonly categories: readonly WeightedCategory[];
  readonly assignments: readonly Assignment[];
  /** The student's grades (others are ignored). */
  readonly grades: readonly Grade[];
  readonly sessions: readonly AttendanceSession[];
  readonly paths: readonly LearningPath[];
  readonly attempts: readonly LessonAttempt[];
  readonly plays: readonly GamePlay[];
}

const byDueDate = (a: Assignment, b: Assignment): number =>
  (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') ||
  a.title.localeCompare(b.title);

const percent = (score: number, total: number): number => Math.round((score / total) * 100);

function attendanceOf(input: FamilyReportInput): FamilyReport['attendance'] {
  const days = input.sessions
    .filter((session) => session.status === 'submitted')
    .flatMap((session) => {
      const status = statusOf(session, input.studentId);
      return status === null ? [] : [{ date: session.date, status }];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const summary = attendanceSummary(days.map((day) => day.status));
  const rate = attendanceRate(summary);
  return {
    summary,
    rate: rate === null ? null : Math.round(rate),
    recent: days.slice(0, recentDays),
  };
}

function gamesOf(plays: readonly GamePlay[]): FamilyReport['games'] {
  const percents = plays.map((play) => percent(play.score, play.total));
  if (percents.length === 0) return { plays: 0, best: null, average: null };
  return {
    plays: percents.length,
    best: Math.max(...percents),
    average: Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length),
  };
}

/**
 * What a family sees about one student: confirmed grades only (the gradebook holds teacher
 * entries; AI drafts and game plays never become grades without the teacher), attendance the
 * teacher submitted, learning progress and games, all by the student's roster ID.
 */
export function buildFamilyReport(input: FamilyReportInput): FamilyReport {
  const shown = input.grades.filter(
    (grade) => grade.studentId === input.studentId && shownStatuses.includes(grade.status),
  );
  const gradeOf = new Map(shown.map((grade) => [grade.assignmentId, grade]));
  const sorted = [...input.assignments].sort(byDueDate);
  const summary = studentGradeSummary(input.categories, input.assignments, shown);
  const until = addDays(input.today, upcomingDays);
  return {
    overall: summary.overall === null ? null : Math.round(summary.overall),
    assignments: sorted.map((assignment) => {
      const grade = gradeOf.get(assignment.id);
      return {
        title: assignment.title,
        dueDate: assignment.dueDate,
        points: assignment.points,
        status: grade === undefined ? 'not_graded' : (grade.status as FamilyGradeStatus),
        score: grade !== undefined && scoredStatuses.includes(grade.status) ? grade.score : null,
      };
    }),
    upcoming: sorted.flatMap((assignment) =>
      assignment.dueDate !== null &&
      !gradeOf.has(assignment.id) &&
      assignment.dueDate >= input.today &&
      assignment.dueDate <= until
        ? [{ title: assignment.title, dueDate: assignment.dueDate }]
        : [],
    ),
    attendance: attendanceOf(input),
    learning: studentLearningProgress(input.paths, input.attempts),
    games: gamesOf(input.plays.filter((play) => play.studentId === input.studentId)),
  };
}
