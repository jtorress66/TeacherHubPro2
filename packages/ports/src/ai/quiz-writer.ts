import type { ExtractedTest, GradeLevel, Language, Result, StandardSubject } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** What the AI may know to write a quiz: the subject, grade and the week's topics. No class or student data. */
export interface QuizRequest {
  readonly subject: StandardSubject;
  readonly grade: GradeLevel;
  readonly topics: readonly string[];
  readonly questionCount: number;
  readonly language: Language;
}

/** Writes a quiz with answers for the teacher to review; it never saves anything. */
export interface QuizWriter {
  write(request: QuizRequest): Promise<Result<ExtractedTest, DraftError>>;
}
