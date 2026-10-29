import type { GradeCategoryId } from '../shared/ids.ts';
import type { GradeStatus } from './grade.ts';

/** One student's grade for one assignment, with what the calculation needs. */
export interface GradeLine {
  readonly categoryId: GradeCategoryId;
  readonly maxPoints: number;
  readonly status: GradeStatus;
  readonly score: number | null;
}

export interface Points {
  readonly earned: number;
  readonly possible: number;
}

export interface CategoryAverage extends Points {
  readonly categoryId: GradeCategoryId;
  readonly percentage: number;
}

export interface WeightedCategory {
  readonly id: GradeCategoryId;
  readonly weightPercent: number;
}

/** Graded and late count with their score, missing counts as 0, excused and pending are left out. */
export function countedPoints(line: GradeLine): Points | null {
  if (line.status === 'excused' || line.status === 'pending') return null;
  const earned = line.status === 'missing' ? 0 : (line.score ?? 0);
  return { earned, possible: line.maxPoints };
}

export function assignmentPercentage(score: number, maxPoints: number): number | null {
  return maxPoints > 0 ? (score / maxPoints) * 100 : null;
}

/** Points-based average per category, for categories with at least one counted grade. */
export function categoryAverages(lines: readonly GradeLine[]): CategoryAverage[] {
  const totals = new Map<GradeCategoryId, Points>();
  for (const line of lines) {
    const points = countedPoints(line);
    if (points === null) continue;
    const total = totals.get(line.categoryId) ?? { earned: 0, possible: 0 };
    totals.set(line.categoryId, {
      earned: total.earned + points.earned,
      possible: total.possible + points.possible,
    });
  }
  return [...totals]
    .filter(([, total]) => total.possible > 0)
    .map(([categoryId, total]) => ({
      categoryId,
      ...total,
      percentage: (total.earned / total.possible) * 100,
    }));
}

/**
 * Overall grade: category averages weighted by `weightPercent`, rescaled over the
 * categories that have counted grades. When those weights are all 0, categories count
 * equally. Lines in categories that are not listed are ignored. Null when nothing counts.
 */
export function overallPercentage(
  categories: readonly WeightedCategory[],
  lines: readonly GradeLine[],
): number | null {
  const averages = new Map(categoryAverages(lines).map((a) => [a.categoryId, a.percentage]));
  const counted = categories.flatMap(({ id, weightPercent }) => {
    const percentage = averages.get(id);
    return percentage === undefined ? [] : [{ percentage, weight: weightPercent }];
  });
  if (counted.length === 0) return null;

  const totalWeight = counted.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return counted.reduce((sum, c) => sum + c.percentage, 0) / counted.length;
  return counted.reduce((sum, c) => sum + c.percentage * c.weight, 0) / totalWeight;
}
