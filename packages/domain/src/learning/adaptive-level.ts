import type { LearningPath } from './learning-path.ts';
import { bestByLesson } from './learning-progress.ts';
import { attemptPercent, type LessonAttempt } from './lesson-attempt.ts';
import { learningLevels } from './path-request.ts';

/** At or above this, a lesson's objective is mastered and the level can rise. */
export const masteredPercent = 85;
/** Below this, a lesson's objective needs review and the level eases. */
export const reviewPercent = 60;

const average = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/** The level for the next path from the scores on the last one. */
export function nextLevel(level: number, percents: readonly number[]): number {
  if (percents.length === 0) return level;
  const mean = average(percents);
  const step = mean >= masteredPercent ? 1 : mean < reviewPercent ? -1 : 0;
  return Math.min(learningLevels.max, Math.max(learningLevels.min, level + step));
}

const latest = (paths: readonly LearningPath[]): LearningPath | undefined =>
  paths.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

/** Where a student's next path in a subject starts: on grade level, then wherever the scores led. */
export function startingLevel(
  paths: readonly LearningPath[],
  attempts: readonly LessonAttempt[],
): number {
  const last = latest(paths);
  if (last === undefined) return learningLevels.onGrade;
  const best = bestByLesson(last, attempts);
  return nextLevel(
    last.level,
    best.flatMap((attempt) => (attempt === null ? [] : [attemptPercent(attempt)])),
  );
}

export interface LearningFocus {
  readonly review: readonly string[];
  readonly mastered: readonly string[];
}

/** The objectives to come back to and the ones already mastered, by each lesson's best attempt. */
export function focusOf(
  paths: readonly LearningPath[],
  attempts: readonly LessonAttempt[],
): LearningFocus {
  const review: string[] = [];
  const mastered: string[] = [];
  for (const path of paths) {
    for (const [index, best] of bestByLesson(path, attempts).entries()) {
      const objective = path.lessons[index]?.objective;
      if (best === null || objective === undefined) continue;
      const percent = attemptPercent(best);
      if (percent < reviewPercent) review.push(objective);
      else if (percent >= masteredPercent) mastered.push(objective);
    }
  }
  return { review, mastered };
}
