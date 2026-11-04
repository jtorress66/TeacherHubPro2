import {
  averageOf,
  failingMetrics,
  pathMetrics,
  PathWriter,
  reviewPath,
  scorePath,
  type PathMetric,
} from '@thp/agents';
import { createPathRequest, type PathRequestInput } from '@thp/domain';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Six languages, levels 1 to 4, with and without objectives to review; each topic keys its saved reply. */
export const pathCases: readonly (PathRequestInput & { readonly topic: string })[] = [
  {
    subject: 'math',
    grade: '4',
    language: 'en',
    level: 3,
    lessonCount: 3,
    topic: 'Comparing fractions',
    review: ['Compare fractions with unlike denominators'],
  },
  {
    subject: 'science',
    grade: '5',
    language: 'es',
    level: 2,
    lessonCount: 3,
    topic: 'El ciclo del agua',
  },
  {
    subject: 'science',
    grade: '3',
    language: 'fr',
    level: 3,
    lessonCount: 3,
    topic: "Les états de l'eau",
  },
  {
    subject: 'math',
    grade: '2',
    language: 'pt',
    level: 1,
    lessonCount: 3,
    topic: 'Adição com reagrupamento',
    review: ['Somar dezenas'],
  },
  {
    subject: 'science',
    grade: '6',
    language: 'de',
    level: 4,
    lessonCount: 3,
    topic: 'Die Zelle',
    mastered: ['Was ist eine Zelle'],
  },
  { subject: 'math', grade: '3', language: 'zh', level: 3, lessonCount: 3, topic: '乘法的意义' },
];

export type PathReport = EvalReport<PathMetric>;

export async function runPathEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<PathMetric, number>>,
  cases: typeof pathCases = pathCases,
): Promise<PathReport> {
  const results: CaseResult<PathMetric>[] = [];
  for (const input of cases) {
    const request = createPathRequest(input);
    if (!request.ok) throw new Error(`Invalid eval case ${input.topic}`);
    const recording = new Recording(llm);
    const draft = await new PathWriter(recording).write(request.value);
    results.push({
      name: `${input.subject} (${input.language})`,
      scores: scorePath(request.value, draft.ok ? draft.value : null),
      problem: problemOf(draft, () => reviewPath(request.value, recording.lastReply)),
    });
  }
  const average = averageOf(
    pathMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
