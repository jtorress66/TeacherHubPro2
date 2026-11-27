import { sameAnswer } from '@thp/domain';
import type { ExplanationRequest } from '@thp/ports';
import { languageEvidence } from '../drafting/language.ts';

export const explanationMetrics = ['structure', 'count', 'language', 'explains'] as const;
export type ExplanationMetric = (typeof explanationMetrics)[number];
export type ExplanationScores = Readonly<Record<ExplanationMetric, number>>;

/**
 * Scores one eval case: one explanation per item, in the game's language, each saying why rather
 * than only repeating the right answer.
 */
export function scoreExplanations(
  request: ExplanationRequest,
  explanations: readonly string[] | null,
): ExplanationScores {
  if (explanations === null) return { structure: 0, count: 0, language: 0, explains: 0 };
  const evidence = languageEvidence(explanations.join('\n'));
  const paired = request.items.map((item, index) => ({ item, text: explanations[index] ?? '' }));
  const explaining = paired.filter(
    ({ item, text }) => text.trim() !== '' && !sameAnswer(text, item.answer),
  ).length;
  return {
    structure: 1,
    count: explanations.length === request.items.length ? 1 : 0,
    language: evidence.hits === 0 || evidence.language === request.language ? 1 : 0,
    explains: request.items.length === 0 ? 1 : explaining / request.items.length,
  };
}
