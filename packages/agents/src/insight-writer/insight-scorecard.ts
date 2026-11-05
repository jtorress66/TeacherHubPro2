import { maxInsightBullets, minInsightBullets } from '@thp/domain';
import type { InsightRequest } from '@thp/ports';
import { inventedPercentages } from './insight-writer.ts';

export const insightMetrics = ['structure', 'count', 'grounded', 'focus'] as const;
export type InsightMetric = (typeof insightMetrics)[number];
export type InsightScores = Readonly<Record<InsightMetric, number>>;

/** What an eval case expects the insight to bring up. */
export interface ExpectedInsight {
  /** Words (any language) at least one bullet must contain, e.g. "missing". */
  readonly mentions: readonly string[];
}

/** Scores one eval case: bullets returned, 3–5 of them, no invented numbers, the focus named. */
export function scoreInsight(
  expected: ExpectedInsight,
  bullets: readonly string[] | null,
  request: InsightRequest,
): InsightScores {
  if (bullets === null) return { structure: 0, count: 0, grounded: 0, focus: 0 };
  const text = bullets.join(' ').toLowerCase();
  const named = expected.mentions.filter((word) => text.includes(word.toLowerCase()));
  return {
    structure: 1,
    count: bullets.length >= minInsightBullets && bullets.length <= maxInsightBullets ? 1 : 0,
    grounded: inventedPercentages(bullets, request).length === 0 ? 1 : 0,
    focus: expected.mentions.length === 0 ? 1 : named.length / expected.mentions.length,
  };
}
