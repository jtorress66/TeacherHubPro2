import {
  averageOf,
  failingMetrics,
  QuizWriter,
  quizMetrics,
  reviewQuiz,
  scoreQuiz,
  type ExpectedQuiz,
  type QuizMetric,
} from '@thp/agents';
import type { LlmClient, QuizRequest } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed weeks of topics, as the prep agent sends them, each with a word per topic to look for. */
export const quizCases: readonly ({
  readonly name: string;
  readonly request: QuizRequest;
} & ExpectedQuiz)[] = [
  {
    name: 'history week, grade 7 (en)',
    request: {
      subject: 'social_studies',
      grade: '7',
      topics: ['Causes of the Civil War', 'Major battles of the Civil War', 'Reconstruction'],
      questionCount: 10,
      language: 'en',
    },
    mentions: ['cause', 'battle', 'reconstruction'],
  },
  {
    name: 'fractions week, grade 4 (es)',
    request: {
      subject: 'math',
      grade: '4',
      topics: ['Fracciones equivalentes', 'Comparar fracciones'],
      questionCount: 10,
      language: 'es',
    },
    mentions: ['equivalente', 'mayor'],
  },
  {
    name: 'short science week, grade 2 (en)',
    request: {
      subject: 'science',
      grade: '2',
      topics: ['Plant life cycle'],
      questionCount: 5,
      language: 'en',
    },
    mentions: ['seed'],
  },
];

export type QuizReport = EvalReport<QuizMetric>;

export async function runQuizEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<QuizMetric, number>>,
  cases: typeof quizCases = quizCases,
): Promise<QuizReport> {
  const results: CaseResult<QuizMetric>[] = [];
  for (const { name, request, ...expected } of cases) {
    const recording = new Recording(llm);
    const quiz = await new QuizWriter(recording).write(request);
    results.push({
      name,
      scores: scoreQuiz(expected, quiz.ok ? quiz.value : null, request),
      problem: problemOf(quiz, () => reviewQuiz(recording.lastReply, request)),
    });
  }
  const average = averageOf(
    quizMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
