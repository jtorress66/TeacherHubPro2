import { describe, expect, it } from 'vitest';
import type { GameGrading } from './game.ts';
import type { ReviewItem } from './game-mode.ts';
import { roundReview, showsAnswersAfterPlay } from './game-review.ts';

const grading = (countAsGrade: boolean, method: GameGrading['method']): GameGrading => ({
  countAsGrade,
  method,
  points: 10,
  categoryId: null,
  assignmentId: null,
});

const missed: ReviewItem[] = [
  { prompt: 'Largest?', given: { text: 'Venus' }, right: { text: 'Jupiter' }, explanation: 'Big.' },
];

describe('showsAnswersAfterPlay', () => {
  it('shows answers after practice games and graded games that count the first try', () => {
    expect(showsAnswersAfterPlay(grading(false, 'best'))).toBe(true);
    expect(showsAnswersAfterPlay(grading(true, 'first'))).toBe(true);
  });

  it('hides them when replaying could raise the grade (best or average)', () => {
    expect(showsAnswersAfterPlay(grading(true, 'best'))).toBe(false);
    expect(showsAnswersAfterPlay(grading(true, 'average'))).toBe(false);
  });
});

describe('roundReview', () => {
  it('keeps the right answer and explanation when answers are shown', () => {
    expect(roundReview(missed, true)).toEqual(missed);
  });

  it('keeps only what was asked and answered when answers are hidden', () => {
    expect(roundReview(missed, false)).toEqual([
      { prompt: 'Largest?', given: { text: 'Venus' }, right: null, explanation: null },
    ]);
  });
});
