import {
  averageOf,
  contentMetrics,
  ContentWriter,
  failingMetrics,
  reviewContent,
  scoreContent,
  type ContentMetric,
} from '@thp/agents';
import { createContentRequest, type ContentRequestInput } from '@thp/domain';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed cases: every content type, every language, and a subject with no Common Core codes. */
export const assistantCases: readonly (ContentRequestInput & { readonly name: string })[] = [
  {
    name: 'worksheet math 4 (en)',
    type: 'worksheet',
    subject: 'math',
    grade: '4',
    topic: 'Equivalent fractions',
    language: 'en',
  },
  {
    name: 'quiz science 7 (es)',
    type: 'quiz',
    subject: 'science',
    grade: '7',
    topic: 'La célula',
    questionCount: 8,
    language: 'es',
  },
  {
    name: 'summary social studies 10 (fr)',
    type: 'summary',
    subject: 'social_studies',
    grade: '10',
    topic: 'La Révolution française',
    language: 'fr',
  },
  {
    name: 'activities ELA 3 (pt)',
    type: 'activities',
    subject: 'ela',
    grade: '3',
    topic: 'Contar uma história',
    language: 'pt',
  },
  {
    name: 'lesson plan math 6 (de)',
    type: 'lesson_plan',
    subject: 'math',
    grade: '6',
    topic: 'Verhältnisse',
    language: 'de',
  },
  {
    name: 'worksheet art 2 (it)',
    type: 'worksheet',
    subject: 'art',
    grade: '2',
    topic: 'I colori primari',
    language: 'it',
  },
  {
    name: 'quiz math 5 (zh)',
    type: 'quiz',
    subject: 'math',
    grade: '5',
    topic: '小数加法',
    questionCount: 5,
    language: 'zh',
  },
  {
    name: 'summary science 3, no codes (en)',
    type: 'summary',
    subject: 'science',
    grade: '3',
    topic: 'Life cycle of a butterfly',
    language: 'en',
  },
];

export type AssistantReport = EvalReport<ContentMetric>;

export async function runAssistantEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<ContentMetric, number>>,
  cases: typeof assistantCases = assistantCases,
): Promise<AssistantReport> {
  const results: CaseResult<ContentMetric>[] = [];
  for (const { name, ...input } of cases) {
    const request = createContentRequest(input);
    if (!request.ok) throw new Error(`Eval case "${name}" is invalid: ${request.error.field}`);
    const recording = new Recording(llm);
    const content = await new ContentWriter(recording).write(request.value);
    results.push({
      name,
      scores: scoreContent(
        request.value,
        content.ok ? content.value : null,
        recording.lastReply.text,
      ),
      problem: problemOf(content, () => reviewContent(recording.lastReply)),
    });
  }
  const average = averageOf(
    contentMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
