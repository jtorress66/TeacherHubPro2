import { gpaFromPercentage } from '../gradebook/gpa.ts';
import {
  categoryAverages,
  overallPercentage,
  type GradeLine,
} from '../gradebook/grade-calculations.ts';
import { letterGrade, type LetterGrade } from '../gradebook/letter-grade.ts';
import type { GradeCategoryId } from '../shared/ids.ts';

/** One category in the free grade calculator: its weight and the scores typed into it. */
export interface CategoryScores {
  readonly weightPercent: number;
  readonly scores: readonly { readonly earned: number; readonly possible: number }[];
}

export interface GradeResult {
  readonly percentage: number;
  readonly letter: LetterGrade;
  readonly gpa: number;
  /** Each category's average, null when it has no scores. */
  readonly categories: readonly (number | null)[];
  /** The weights as typed, so the page can say when they do not add up to 100. */
  readonly weightTotal: number;
}

const usable = (score: { earned: number; possible: number }) =>
  Number.isFinite(score.earned) &&
  Number.isFinite(score.possible) &&
  score.earned >= 0 &&
  score.possible > 0;

/**
 * The free grade calculator: the same weighted average, letter and GPA as the gradebook. Null
 * when nothing counts or a weight is impossible.
 */
export function calculateGrade(input: readonly CategoryScores[]): GradeResult | null {
  if (input.some((c) => !Number.isFinite(c.weightPercent) || c.weightPercent < 0)) return null;
  const categories = input.map((category, index) => ({
    id: `category-${String(index)}` as GradeCategoryId,
    weightPercent: category.weightPercent,
  }));
  const lines: GradeLine[] = input.flatMap((category, index) =>
    category.scores.filter(usable).map((score) => ({
      categoryId: `category-${String(index)}` as GradeCategoryId,
      maxPoints: score.possible,
      status: 'graded' as const,
      score: score.earned,
    })),
  );
  const percentage = overallPercentage(categories, lines);
  if (percentage === null) return null;
  const averages = new Map(categoryAverages(lines).map((a) => [a.categoryId, a.percentage]));
  return {
    percentage,
    letter: letterGrade(percentage),
    gpa: gpaFromPercentage(percentage),
    categories: categories.map((category) => averages.get(category.id) ?? null),
    weightTotal: input.reduce((sum, category) => sum + category.weightPercent, 0),
  };
}

const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/;
const percent = /^(\d+(?:\.\d+)?)\s*%?$/;

/**
 * Scores as typed: "18/20" is 18 of 20 points, "85" or "85%" is 85 of 100. One per line, or
 * separated by "; " or ", ". What cannot be read is counted, never guessed.
 */
export function parseScores(text: string): {
  readonly scores: { readonly earned: number; readonly possible: number }[];
  readonly unread: number;
} {
  const scores: { earned: number; possible: number }[] = [];
  let unread = 0;
  for (const raw of text.split(/\r?\n|;|,\s+/)) {
    const token = raw.trim().replace(',', '.');
    if (token === '') continue;
    const asFraction = fraction.exec(token);
    const asPercent = asFraction === null ? percent.exec(token) : null;
    const earned = Number(asFraction?.[1] ?? asPercent?.[1] ?? Number.NaN);
    const possible = asFraction === null ? 100 : Number(asFraction[2]);
    if (Number.isFinite(earned) && possible > 0) scores.push({ earned, possible });
    else unread += 1;
  }
  return { scores, unread };
}
