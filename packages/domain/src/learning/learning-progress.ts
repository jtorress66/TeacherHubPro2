import type { AssistantSubject } from '../assistant/content-request.ts';
import type { LearningPath } from './learning-path.ts';
import { attemptPercent, type LessonAttempt } from './lesson-attempt.ts';

/** Each lesson's best attempt on this path (null when not yet done). */
export function bestByLesson(
  path: LearningPath,
  attempts: readonly LessonAttempt[],
): (LessonAttempt | null)[] {
  return path.lessons.map((_, index) => {
    let best: LessonAttempt | null = null;
    for (const attempt of attempts) {
      if (attempt.pathId !== path.id || attempt.lesson !== index) continue;
      if (best === null || attemptPercent(attempt) > attemptPercent(best)) best = attempt;
    }
    return best;
  });
}

export interface LessonProgress {
  readonly done: boolean;
  readonly best: number | null;
  readonly attempts: number;
}

export interface PathProgress {
  readonly done: number;
  readonly total: number;
  readonly percent: number;
  /** The mean of each done lesson's best score, or null before the first. */
  readonly average: number | null;
  readonly lessons: readonly LessonProgress[];
  readonly lastActivity: Date | null;
}

const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const latestOf = (dates: readonly Date[]): Date | null =>
  dates.reduce<Date | null>((last, at) => (last === null || at > last ? at : last), null);

/** How far a student is along one path. Attempts on lessons the path lacks are ignored. */
export function pathProgress(path: LearningPath, attempts: readonly LessonAttempt[]): PathProgress {
  const own = attempts.filter(
    (attempt) =>
      attempt.pathId === path.id && attempt.lesson >= 0 && attempt.lesson < path.lessons.length,
  );
  const best = bestByLesson(path, own);
  const percents = best.flatMap((attempt) => (attempt === null ? [] : [attemptPercent(attempt)]));
  const total = path.lessons.length;
  return {
    done: percents.length,
    total,
    percent: total === 0 ? 0 : Math.round((percents.length / total) * 100),
    average: mean(percents),
    lessons: best.map((attempt, index) => ({
      done: attempt !== null,
      best: attempt === null ? null : attemptPercent(attempt),
      attempts: own.filter((a) => a.lesson === index).length,
    })),
    lastActivity: latestOf(own.map((attempt) => attempt.at)),
  };
}

export interface SubjectProgress {
  readonly subject: AssistantSubject;
  readonly paths: number;
  readonly done: number;
  readonly total: number;
  readonly average: number | null;
  /** The level of the latest path. */
  readonly level: number;
  readonly lastActivity: Date | null;
}

/** A student's progress per subject, over the paths they were given (drafts are not theirs yet). */
export function studentLearningProgress(
  paths: readonly LearningPath[],
  attempts: readonly LessonAttempt[],
): SubjectProgress[] {
  const given = paths
    .filter((path) => path.status !== 'draft')
    .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const subjects = [...new Set(given.map((path) => path.subject))].sort();
  return subjects.map((subject) => {
    const own = given.filter((path) => path.subject === subject);
    const progress = own.map((path) => pathProgress(path, attempts));
    const bests = own.flatMap((path) =>
      bestByLesson(path, attempts).flatMap((a) => (a === null ? [] : [attemptPercent(a)])),
    );
    return {
      subject,
      paths: own.length,
      done: progress.reduce((sum, p) => sum + p.done, 0),
      total: progress.reduce((sum, p) => sum + p.total, 0),
      average: mean(bests),
      level: own.at(-1)?.level ?? 0,
      lastActivity: latestOf(
        progress.flatMap((p) => (p.lastActivity === null ? [] : [p.lastActivity])),
      ),
    };
  });
}
