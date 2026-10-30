import { LessonPlanner, averageScores, belowThreshold, scorePlan } from '@thp/agents';
import type { PlanMetric, PlanScores } from '@thp/agents';
import { createDraftRequest, type DraftRequestInput } from '@thp/domain';
import type { LlmClient, LlmRequest } from '@thp/ports';

/** Fixed cases: every language, each subject, and a grade with no Common Core codes. */
export const plannerCases: readonly (DraftRequestInput & { readonly name: string })[] = [
  {
    name: 'math grade 4 (en)',
    kind: 'weekly',
    subject: 'math',
    grade: '4',
    topic: 'Comparing fractions',
    language: 'en',
    start: '2026-09-07',
  },
  {
    name: 'ELA grade 7 (es)',
    kind: 'weekly',
    subject: 'ela',
    grade: '7',
    topic: 'Lenguaje figurado en la poesía',
    language: 'es',
    start: '2026-09-07',
  },
  {
    name: 'science grade 8 (en)',
    kind: 'weekly',
    subject: 'science',
    grade: '8',
    topic: 'Chemical reactions',
    language: 'en',
    start: '2026-09-07',
    difficulty: 'hard',
  },
  {
    name: 'social studies grade 10 (fr)',
    kind: 'weekly',
    subject: 'social_studies',
    grade: '10',
    topic: 'Les causes de la Première Guerre mondiale',
    language: 'fr',
    start: '2026-09-07',
  },
  {
    name: 'science grade 3, no codes (en)',
    kind: 'weekly',
    subject: 'science',
    grade: '3',
    topic: 'Life cycles of plants',
    language: 'en',
    start: '2026-09-07',
  },
  {
    name: 'math grade 2 (zh)',
    kind: 'weekly',
    subject: 'math',
    grade: '2',
    topic: '认识时间',
    language: 'zh',
    start: '2026-09-07',
  },
  {
    name: 'ELA grade 5 (de)',
    kind: 'weekly',
    subject: 'ela',
    grade: '5',
    topic: 'Eine Geschichte nacherzählen',
    language: 'de',
    start: '2026-09-07',
    durationMinutes: 50,
  },
  {
    name: 'Conversational English (es)',
    kind: 'conversational_english',
    grade: '6',
    topic: 'Pedir comida en un restaurante',
    language: 'es',
    start: '2026-09-09',
  },
  {
    name: 'Conversational English (pt)',
    kind: 'conversational_english',
    grade: '9',
    topic: 'Apresentações pessoais',
    language: 'pt',
    start: '2026-09-09',
  },
  {
    name: 'math grade 6 (it)',
    kind: 'weekly',
    subject: 'math',
    grade: '6',
    topic: 'Rapporti e proporzioni',
    language: 'it',
    start: '2026-09-07',
  },
];

/** Keeps the model's last raw reply, so the scorecard can see codes the planner dropped. */
class Recording implements LlmClient {
  lastText = '';

  constructor(private readonly inner: LlmClient) {}

  async complete(request: LlmRequest) {
    const reply = await this.inner.complete(request);
    this.lastText = reply.ok ? reply.value.text : '';
    return reply;
  }
}

export interface CaseResult {
  readonly name: string;
  readonly scores: PlanScores;
}

export interface EvalReport {
  readonly cases: readonly CaseResult[];
  readonly average: PlanScores;
  readonly failing: readonly PlanMetric[];
}

export async function runPlannerEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<PlanMetric, number>>,
  cases: typeof plannerCases = plannerCases,
): Promise<EvalReport> {
  const results: CaseResult[] = [];
  for (const { name, ...input } of cases) {
    const request = createDraftRequest(input);
    if (!request.ok) throw new Error(`Eval case "${name}" is invalid: ${request.error.field}`);
    const recording = new Recording(llm);
    const draft = await new LessonPlanner(recording).draft(request.value);
    results.push({
      name,
      scores: scorePlan(request.value, draft.ok ? draft.value : null, recording.lastText),
    });
  }
  const average = averageScores(results.map((r) => r.scores));
  return { cases: results, average, failing: belowThreshold(average, thresholds) };
}

const cell = (value: number) => value.toFixed(2).padStart(6);

/** A plain-text table of the scores, one row per case and the average last. */
export function formatReport(report: EvalReport): string {
  const metrics = Object.keys(report.average) as PlanMetric[];
  const width = Math.max(...report.cases.map((c) => c.name.length), 'average'.length);
  const row = (name: string, scores: PlanScores) =>
    `${name.padEnd(width)} ${metrics.map((m) => cell(scores[m])).join(' ')}`;
  return [
    `${''.padEnd(width)} ${metrics.map((m) => m.slice(0, 6).padStart(6)).join(' ')}`,
    ...report.cases.map((c) => row(c.name, c.scores)),
    row('average', report.average),
    report.failing.length === 0
      ? 'All thresholds met.'
      : `Below threshold: ${report.failing.join(', ')}`,
  ].join('\n');
}
