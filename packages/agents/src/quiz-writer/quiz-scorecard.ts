import type { ExtractedTest } from '@thp/domain';
import type { QuizRequest } from '@thp/ports';
import { quizQuestionTypes } from './quiz-writer.ts';

export const quizMetrics = ['structure', 'count', 'types', 'coverage'] as const;
export type QuizMetric = (typeof quizMetrics)[number];
export type QuizScores = Readonly<Record<QuizMetric, number>>;

/** What an eval case expects the quiz to cover. */
export interface ExpectedQuiz {
  /** Words (any language), one per topic, that at least one question must contain. */
  readonly mentions: readonly string[];
}

/** Scores one eval case: a quiz returned, the count asked for, allowed types, every topic asked. */
export function scoreQuiz(
  expected: ExpectedQuiz,
  quiz: ExtractedTest | null,
  request: QuizRequest,
): QuizScores {
  if (quiz === null) return { structure: 0, count: 0, types: 0, coverage: 0 };
  const allowed = quiz.questions.filter((q) =>
    (quizQuestionTypes as readonly string[]).includes(q.type),
  );
  const text = quiz.questions
    .map((q) => q.prompt)
    .join(' ')
    .toLowerCase();
  const covered = expected.mentions.filter((word) => text.includes(word.toLowerCase()));
  return {
    structure: 1,
    count: quiz.questions.length === request.questionCount ? 1 : 0,
    types: allowed.length === quiz.questions.length ? 1 : 0,
    coverage: expected.mentions.length === 0 ? 1 : covered.length / expected.mentions.length,
  };
}
