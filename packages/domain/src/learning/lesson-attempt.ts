import type { LearningPathId, LessonAttemptId, SchoolId, StudentId } from '../shared/ids.ts';
import type { LearningLesson } from './learning-path.ts';

/** A student's answers to one lesson's check. The first completes the lesson; retries are kept. */
export interface LessonAttempt {
  readonly id: LessonAttemptId;
  readonly schoolId: SchoolId;
  readonly pathId: LearningPathId;
  readonly studentId: StudentId;
  /** The lesson's position in the path. */
  readonly lesson: number;
  /** The chosen option per check; null where none (or no valid one) was chosen. */
  readonly answers: readonly (number | null)[];
  readonly score: number;
  readonly total: number;
  readonly at: Date;
}

/** A check the student got wrong, with the right answer to show after submitting. */
export interface Correction {
  readonly check: number;
  readonly answer: number;
  readonly right: string;
}

export interface CheckScore {
  readonly score: number;
  readonly total: number;
  readonly answers: readonly (number | null)[];
  readonly corrections: readonly Correction[];
}

const optionIndex = (value: unknown, options: number): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < options
    ? value
    : null;

/** Scores what the browser sent; anything missing or malformed counts as wrong. */
export function scoreCheck(lesson: LearningLesson, sent: readonly unknown[]): CheckScore {
  const answers = lesson.checks.map((check, i) => optionIndex(sent[i], check.options.length));
  const corrections = lesson.checks.flatMap((check, i) =>
    answers[i] === check.answer
      ? []
      : [{ check: i, answer: check.answer, right: check.options[check.answer] ?? '' }],
  );
  return {
    score: lesson.checks.length - corrections.length,
    total: lesson.checks.length,
    answers,
    corrections,
  };
}

export const attemptPercent = (attempt: Pick<LessonAttempt, 'score' | 'total'>): number =>
  attempt.total === 0 ? 0 : Math.round((attempt.score / attempt.total) * 100);
