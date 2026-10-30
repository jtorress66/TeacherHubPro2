/** Eval scores: each metric is a number from 0 to 1 for one case. */
export type Scores<M extends string> = Readonly<Record<M, number>>;

/** The mean of each metric over all cases (0 when there are none). */
export function averageOf<M extends string>(
  metrics: readonly M[],
  scores: readonly Scores<M>[],
): Record<M, number> {
  const result = {} as Record<M, number>;
  for (const metric of metrics) {
    result[metric] =
      scores.length === 0 ? 0 : scores.reduce((sum, s) => sum + s[metric], 0) / scores.length;
  }
  return result;
}

/** The metrics whose score is below their threshold. */
export const failingMetrics = <M extends string>(
  scores: Scores<M>,
  thresholds: Readonly<Record<M, number>>,
): M[] => (Object.keys(thresholds) as M[]).filter((metric) => scores[metric] < thresholds[metric]);
