import type { ExtractedTest, Language, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Reads a test's text into questions for the teacher to review; it never saves anything. */
export interface QuestionExtractor {
  extract(input: {
    readonly text: string;
    readonly language: Language;
  }): Promise<Result<ExtractedTest, DraftError>>;
}
