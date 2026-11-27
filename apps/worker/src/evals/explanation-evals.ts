import {
  averageOf,
  explanationMetrics,
  ExplanationWriter,
  failingMetrics,
  reviewExplanations,
  scoreExplanations,
  type ExplanationMetric,
} from '@thp/agents';
import type { ExplanationRequest, LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Cases across kinds and languages; each first question keys its saved reply. */
export const explanationCases: readonly ExplanationRequest[] = [
  {
    language: 'en',
    items: [
      {
        index: 0,
        question: 'Which planet is closest to the Sun?',
        options: ['Mercury', 'Venus', 'Earth'],
        answer: 'Mercury',
      },
      { index: 1, question: 'The Moon makes its own light', answer: 'false' },
      { index: 2, question: 'Plants need ___ to make their food.', answer: 'sunlight' },
    ],
  },
  {
    language: 'es',
    items: [
      {
        index: 0,
        question: '¿Qué fracción es igual a 2/4?',
        options: ['1/3', '1/2', '3/4'],
        answer: '1/2',
      },
      { index: 1, question: '3/4 es mayor que 1/4', answer: 'true' },
    ],
  },
  {
    language: 'zh',
    items: [
      { index: 0, question: '太阳照射海洋，水受热变成___。', answer: '水蒸气' },
      { index: 1, question: '云是由小水滴组成的', answer: 'true' },
    ],
  },
];

export type ExplanationReport = EvalReport<ExplanationMetric>;

export async function runExplanationEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<ExplanationMetric, number>>,
  cases: readonly ExplanationRequest[] = explanationCases,
): Promise<ExplanationReport> {
  const results: CaseResult<ExplanationMetric>[] = [];
  for (const request of cases) {
    const recording = new Recording(llm);
    const explained = await new ExplanationWriter(recording).explain(request);
    results.push({
      name: `${request.items[0]?.question ?? ''} (${request.language})`,
      scores: scoreExplanations(request, explained.ok ? explained.value : null),
      problem: problemOf(explained, () => reviewExplanations(recording.lastReply, request)),
    });
  }
  const average = averageOf(
    explanationMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
