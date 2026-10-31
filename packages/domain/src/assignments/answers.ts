import type { Question, QuestionType } from '../gradebook/question.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

// A student's answers are kept as text, one per question id: an option index for multiple choice,
// `true`/`false`, the written text, or a JSON object of left → right for matching.

export const maxAnswerLength = 2000;
export const maxEssayLength = 10_000;

type Checked = Result<string, ValidationError>;
type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;

/** How each question type reads (and scores) an answer. A new type adds an entry here. */
interface AnswerRule<T extends QuestionType> {
  readonly parse: (question: QuestionOf<T>, answer: string) => Checked;
  /** Points earned, or null when a person (or the AI) must judge the answer. */
  readonly score: (question: QuestionOf<T>, answer: string) => number | null;
}

const text =
  (maxLength: number) =>
  (question: Question, answer: string): Checked =>
    answer.length > maxLength ? invalid(question.id, 'too_long') : ok(answer);

/** Lower case, single spaces, no ending punctuation: how blanks are compared. */
export const normalizeBlank = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/, '');

function matchingAnswer(answer: string): Readonly<Record<string, unknown>> | null {
  try {
    const parsed: unknown = JSON.parse(answer);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const allOrNothing = (earned: boolean, points: number) => (earned ? points : 0);
const round = (value: number) => Math.round(value * 100) / 100;

const rules: { readonly [T in QuestionType]: AnswerRule<T> } = {
  multiple_choice: {
    parse: (question, answer) => {
      if (!/^\d+$/.test(answer)) return invalid(question.id, 'invalid_format');
      return Number(answer) < question.options.length
        ? ok(answer)
        : invalid(question.id, 'out_of_range');
    },
    score: (question, answer) =>
      allOrNothing(Number(answer) === question.correctOption, question.points),
  },
  true_false: {
    parse: (question, answer) =>
      answer === 'true' || answer === 'false' ? ok(answer) : invalid(question.id, 'invalid_format'),
    score: (question, answer) =>
      allOrNothing((answer === 'true') === question.answer, question.points),
  },
  fill_blank: {
    parse: text(maxAnswerLength),
    score: (question, answer) =>
      allOrNothing(
        question.acceptedAnswers.some(
          (accepted) => normalizeBlank(accepted) === normalizeBlank(answer),
        ),
        question.points,
      ),
  },
  matching: {
    parse: (question, answer) => {
      const chosen = matchingAnswer(answer);
      if (chosen === null) return invalid(question.id, 'invalid_format');
      const lefts = new Set(question.pairs.map((pair) => pair.left));
      const rights = new Set(question.pairs.map((pair) => pair.right));
      const valid = Object.entries(chosen).every(
        ([left, right]) => lefts.has(left) && typeof right === 'string' && rights.has(right),
      );
      return valid ? ok(answer) : invalid(question.id, 'not_allowed');
    },
    score: (question, answer) => {
      const chosen = matchingAnswer(answer) ?? {};
      const correct = question.pairs.filter((pair) => chosen[pair.left] === pair.right).length;
      return round((correct / question.pairs.length) * question.points);
    },
  },
  short_answer: { parse: text(maxAnswerLength), score: () => null },
  essay: { parse: text(maxEssayLength), score: () => null },
};

const ruleFor = <T extends QuestionType>(question: QuestionOf<T>) =>
  rules[question.type] as unknown as AnswerRule<T>;

/** A student's answer to one question, checked for its type; blank means unanswered (null). */
export function parseAnswer(
  question: Question,
  raw: string | undefined,
): Result<string | null, ValidationError> {
  const answer = raw?.trim() ?? '';
  if (answer === '') return ok(null);
  return ruleFor(question).parse(question, answer);
}

/** Points for an objective answer (an unanswered one scores 0), or null for an open question. */
export function autoScore(question: Question, answer: string | null): number | null {
  const rule = ruleFor(question);
  if (rule.score(question, '') === null) return null;
  return answer === null ? 0 : rule.score(question, answer);
}

/** Short answers and essays need judgement; everything else is scored by code. */
export const isOpenQuestion = (question: Question): boolean => autoScore(question, null) === null;
