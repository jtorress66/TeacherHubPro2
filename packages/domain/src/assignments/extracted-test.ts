import { createQuestion, type Question, type QuestionInput } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';

export const maxExtractedQuestions = 100;

/** A question as the AI reads it from a PDF: everything but the id. */
export type ExtractedQuestionInput = {
  [T in QuestionInput['type']]: Omit<Extract<QuestionInput, { type: T }>, 'id'>;
}[QuestionInput['type']];

/** A test read from a PDF, for the teacher to review and edit before saving. */
export interface ExtractedTest {
  readonly instructions: string | null;
  readonly questions: readonly Question[];
}

export function createExtractedTest(input: {
  readonly instructions: string | null;
  readonly questions: readonly ExtractedQuestionInput[];
}): Result<ExtractedTest, ValidationError> {
  const instructions = optionalText('instructions', input.instructions, 2000);
  if (!instructions.ok) return instructions;
  if (input.questions.length === 0) return invalid('questions', 'required');
  if (input.questions.length > maxExtractedQuestions) return invalid('questions', 'out_of_range');
  const questions: Question[] = [];
  for (const [index, question] of input.questions.entries()) {
    const created = createQuestion({
      ...question,
      id: `q${String(index + 1)}` as QuestionId,
    });
    if (!created.ok) {
      return invalid(`questions.${String(index)}.${created.error.field}`, created.error.code);
    }
    questions.push(created.value);
  }
  return ok({ instructions: instructions.value, questions });
}
