import type { Question, QuestionType } from '../gradebook/question.ts';
import { normalizeBlank, readMatchingAnswer } from './answers.ts';

// How a student's stored answer reads to their teacher: the option they picked rather than its
// index, each matching pair, and what the right answer was. Display only; scoring is in answers.ts.

export interface MatchedPair {
  readonly left: string;
  /** Null when the student left this one unmatched. */
  readonly right: string | null;
  readonly correct: boolean;
}

export type AnswerDescription =
  | { readonly kind: 'unanswered' }
  | {
      readonly kind: 'choice';
      readonly letter: string;
      readonly text: string;
      readonly correct: boolean;
      readonly correctLetter: string;
      readonly correctText: string;
    }
  | { readonly kind: 'truefalse'; readonly value: boolean; readonly correct: boolean }
  | {
      readonly kind: 'blank';
      readonly text: string;
      readonly correct: boolean;
      readonly accepted: readonly string[];
    }
  | { readonly kind: 'matching'; readonly pairs: readonly MatchedPair[] }
  /** Written answers, and anything stored in a shape its question does not expect. */
  | { readonly kind: 'text'; readonly text: string };

type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;
type Describe<T extends QuestionType> = (
  question: QuestionOf<T>,
  answer: string,
) => AnswerDescription;

const asText = (text: string): AnswerDescription => ({ kind: 'text', text });

/** A, B, C… for options; past Z, the option's number. */
export const optionLetter = (index: number): string =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

/** How each question type reads an answer. A new type adds an entry here. */
const describers: { readonly [T in QuestionType]: Describe<T> } = {
  multiple_choice: (question, answer) => {
    const index = /^\d+$/.test(answer) ? Number(answer) : -1;
    const text = question.options[index];
    const correctText = question.options[question.correctOption] ?? '';
    return text === undefined
      ? asText(answer)
      : {
          kind: 'choice',
          letter: optionLetter(index),
          text,
          correct: index === question.correctOption,
          correctLetter: optionLetter(question.correctOption),
          correctText,
        };
  },
  true_false: (question, answer) =>
    answer === 'true' || answer === 'false'
      ? {
          kind: 'truefalse',
          value: answer === 'true',
          correct: (answer === 'true') === question.answer,
        }
      : asText(answer),
  fill_blank: (question, answer) => ({
    kind: 'blank',
    text: answer,
    correct: question.acceptedAnswers.some((a) => normalizeBlank(a) === normalizeBlank(answer)),
    accepted: question.acceptedAnswers,
  }),
  matching: (question, answer) => {
    const chosen = readMatchingAnswer(answer);
    if (chosen === null) return asText(answer);
    return {
      kind: 'matching',
      pairs: question.pairs.map(({ left, right }) => {
        const picked = chosen[left];
        const matched = typeof picked === 'string' ? picked : null;
        return { left, right: matched, correct: matched === right };
      }),
    };
  },
  short_answer: (_question, answer) => asText(answer),
  essay: (_question, answer) => asText(answer),
};

/** A student's stored answer to one question, described for the teacher reviewing it. */
export function describeAnswer(question: Question, raw: string | undefined): AnswerDescription {
  const answer = raw?.trim() ?? '';
  if (answer === '') return { kind: 'unanswered' };
  const describe = describers[question.type] as Describe<QuestionType>;
  return describe(question, answer);
}
