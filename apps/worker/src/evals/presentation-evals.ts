import {
  averageOf,
  failingMetrics,
  presentationMetrics,
  PresentationWriter,
  reviewSlides,
  scorePresentation,
  type PresentationMetric,
} from '@thp/agents';
import { createPresentationRequest, type PresentationRequestInput } from '@thp/domain';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed cases in several languages and slide counts. */
export const presentationCases: readonly (PresentationRequestInput & { readonly name: string })[] =
  [
    {
      name: 'volcanoes science 5 (en)',
      topic: 'Volcanoes',
      subject: 'science',
      grade: '5',
      slideCount: 6,
      language: 'en',
    },
    {
      name: 'fracciones math 4 (es)',
      topic: 'Fracciones equivalentes',
      subject: 'math',
      grade: '4',
      slideCount: 5,
      language: 'es',
    },
    {
      name: 'les saisons science 2 (fr)',
      topic: 'Les saisons',
      subject: 'science',
      grade: '2',
      slideCount: 4,
      language: 'fr',
    },
    {
      name: 'water cycle science 6 (zh)',
      topic: '水循环',
      subject: 'science',
      grade: '6',
      slideCount: 6,
      language: 'zh',
    },
  ];

export type PresentationReport = EvalReport<PresentationMetric>;

export async function runPresentationEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<PresentationMetric, number>>,
  cases: typeof presentationCases = presentationCases,
): Promise<PresentationReport> {
  const results: CaseResult<PresentationMetric>[] = [];
  for (const { name, ...input } of cases) {
    const request = createPresentationRequest(input);
    if (!request.ok) throw new Error(`Eval case "${name}" is invalid: ${request.error.field}`);
    const recording = new Recording(llm);
    const draft = await new PresentationWriter(recording).draft(request.value);
    results.push({
      name,
      scores: scorePresentation(request.value, draft.ok ? draft.value : null),
      problem: problemOf(draft, () => reviewSlides(request.value, recording.lastReply)),
    });
  }
  const average = averageOf(
    presentationMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
