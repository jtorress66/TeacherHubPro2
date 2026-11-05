import type { FormsQuiz, Result } from '@thp/domain';
import type { ClassroomError } from './classroom.ts';

/** `insufficient_scope`: the teacher connected before Forms access was asked for. */
export type FormsError = ClassroomError;

export interface CreatedForm {
  readonly id: string;
  readonly editUrl: string;
  readonly responderUrl: string;
}

/** Builds a self-scoring quiz in the teacher's Google Forms. */
export interface GoogleForms {
  createQuiz(accessToken: string, quiz: FormsQuiz): Promise<Result<CreatedForm, FormsError>>;
}
