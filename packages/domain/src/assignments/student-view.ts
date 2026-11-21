import type { Question, QuestionType } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';

/** A question as a student sees it: never the answer, model answer or rubric. */
export interface StudentQuestion {
  readonly id: QuestionId;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly points: number;
  readonly instructions: string | null;
  /** Multiple choice options, in the teacher's order. */
  readonly options: readonly string[];
  /** Matching: the items to match, and the choices for each (sorted, so order hides nothing). */
  readonly lefts: readonly string[];
  readonly rights: readonly string[];
}

export function questionForStudent(question: Question): StudentQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    instructions: question.instructions,
    options: question.type === 'multiple_choice' ? question.options : [],
    lefts: question.type === 'matching' ? question.pairs.map((pair) => pair.left) : [],
    rights:
      question.type === 'matching'
        ? question.pairs.map((pair) => pair.right).sort((a, b) => a.localeCompare(b))
        : [],
  };
}

/**
 * What read-aloud says for one question: its instructions, the question, then each choice (or each
 * item to match). Matching choices are left out: read in order, they would hint at the answers.
 */
export function spokenQuestion(
  question: StudentQuestion,
  labels: { readonly true: string; readonly false: string },
): string {
  const choices =
    question.type === 'true_false'
      ? [labels.true, labels.false]
      : question.type === 'matching'
        ? question.lefts
        : question.options;
  const parts = [question.instructions, question.prompt].filter((part) => part !== null);
  if (choices.length > 0) parts.push(choices.map((choice) => `${choice}.`).join('\n'));
  return parts.join('\n\n');
}
