import type { GameGrading } from './game.ts';
import type { ReviewAnswer, ReviewItem } from './game-mode.ts';

/** A missed item as the player sees it after the round; the answer is null when it is hidden. */
export interface RoundReviewItem {
  readonly prompt: string;
  readonly given: ReviewAnswer | null;
  readonly right: ReviewAnswer | null;
  readonly explanation: string | null;
}

/**
 * Whether students see the right answers and explanations after a round. A graded game that
 * keeps the best or average try hides them, or replaying with the answers would raise the grade.
 */
export const showsAnswersAfterPlay = (grading: GameGrading): boolean =>
  !grading.countAsGrade || grading.method === 'first';

/** The missed items, with or without their answers and explanations. */
export const roundReview = (
  items: readonly ReviewItem[],
  showAnswers: boolean,
): RoundReviewItem[] =>
  items.map((item) =>
    showAnswers ? item : { prompt: item.prompt, given: item.given, right: null, explanation: null },
  );
