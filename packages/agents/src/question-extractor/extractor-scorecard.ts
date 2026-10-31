import type { ExtractedTest, QuestionType } from '@thp/domain';

export const extractorMetrics = ['structure', 'questionCount', 'types', 'instructions'] as const;
export type ExtractorMetric = (typeof extractorMetrics)[number];
export type ExtractorScores = Readonly<Record<ExtractorMetric, number>>;

/** What an eval case expects from a test's text. */
export interface ExpectedExtraction {
  /** One per question, in order: each blank, statement or item is its own question. */
  readonly types: readonly QuestionType[];
  /** Text (such as a word bank) that must reach at least one question's instructions. */
  readonly instructionsContain: string | null;
}

/** Scores one eval case from what it expects and what the extractor returned. */
export function scoreExtraction(
  expected: ExpectedExtraction,
  test: ExtractedTest | null,
): ExtractorScores {
  if (test === null) return { structure: 0, questionCount: 0, types: 0, instructions: 0 };
  const matching = expected.types.filter((type, i) => test.questions[i]?.type === type).length;
  const needle = expected.instructionsContain;
  return {
    structure: 1,
    questionCount: test.questions.length === expected.types.length ? 1 : 0,
    types: expected.types.length === 0 ? 1 : matching / expected.types.length,
    instructions:
      needle === null || test.questions.some((q) => q.instructions?.includes(needle)) ? 1 : 0,
  };
}
