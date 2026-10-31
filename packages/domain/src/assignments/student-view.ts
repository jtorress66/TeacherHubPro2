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
