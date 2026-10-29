import type { QuestionId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export const questionTypes = [
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
  'matching',
  'essay',
] as const;

export type QuestionType = (typeof questionTypes)[number];

/** Points per question when none are given (as in the original app). */
export const defaultQuestionPoints = 10;

export interface MatchingPair {
  readonly left: string;
  readonly right: string;
}

/** What each question type adds to the common fields. */
interface Bodies {
  multiple_choice: { readonly options: readonly string[]; readonly correctOption: number };
  true_false: { readonly answer: boolean };
  fill_blank: { readonly acceptedAnswers: readonly string[] };
  short_answer: { readonly modelAnswer: string | null };
  matching: { readonly pairs: readonly MatchingPair[] };
  essay: { readonly rubric: string | null };
}

interface BodyInputs {
  multiple_choice: { readonly options: readonly string[]; readonly correctOption: number };
  true_false: { readonly answer: boolean };
  fill_blank: { readonly acceptedAnswers: readonly string[] };
  short_answer: { readonly modelAnswer?: string | null };
  matching: { readonly pairs: readonly MatchingPair[] };
  essay: { readonly rubric?: string | null };
}

interface Common {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly points: number;
  readonly instructions: string | null;
}

interface CommonInput {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly points?: number;
  readonly instructions?: string | null;
}

export type Question = {
  [T in QuestionType]: { readonly type: T } & Common & Bodies[T];
}[QuestionType];

export type QuestionInput = {
  [T in QuestionType]: { readonly type: T } & CommonInput & BodyInputs[T];
}[QuestionType];

type BodyRule<T extends QuestionType> = (
  input: BodyInputs[T],
) => Result<Bodies[T], ValidationError>;

const trimmedNonBlank = (values: readonly string[]): string[] | null => {
  const trimmed = values.map((value) => value.trim());
  return trimmed.some((value) => value === '') ? null : trimmed;
};

const bodyRules: { [T in QuestionType]: BodyRule<T> } = {
  multiple_choice: ({ options, correctOption }) => {
    const trimmed = trimmedNonBlank(options);
    if (trimmed === null || trimmed.length < 2) return invalid('options', 'required');
    const inRange =
      Number.isInteger(correctOption) && correctOption >= 0 && correctOption < trimmed.length;
    return inRange
      ? ok({ options: trimmed, correctOption })
      : invalid('correctOption', 'out_of_range');
  },
  true_false: ({ answer }) => ok({ answer }),
  fill_blank: ({ acceptedAnswers }) => {
    const trimmed = trimmedNonBlank(acceptedAnswers);
    return trimmed === null || trimmed.length === 0
      ? invalid('acceptedAnswers', 'required')
      : ok({ acceptedAnswers: trimmed });
  },
  short_answer: ({ modelAnswer }) => {
    const answer = optionalText('modelAnswer', modelAnswer, 2000);
    return answer.ok ? ok({ modelAnswer: answer.value }) : answer;
  },
  matching: ({ pairs }) => {
    const trimmed = pairs.map(({ left, right }) => ({ left: left.trim(), right: right.trim() }));
    if (trimmed.length < 2 || trimmed.some(({ left, right }) => left === '' || right === '')) {
      return invalid('pairs', 'required');
    }
    if (new Set(trimmed.map(({ left }) => left)).size !== trimmed.length) {
      return invalid('pairs', 'duplicate');
    }
    return ok({ pairs: trimmed });
  },
  essay: ({ rubric }) => {
    const text = optionalText('rubric', rubric, 2000);
    return text.ok ? ok({ rubric: text.value }) : text;
  },
};

function validateBody<T extends QuestionType>(
  type: T,
  input: BodyInputs[T],
): Result<Bodies[T], ValidationError> {
  return (bodyRules[type] as BodyRule<T>)(input);
}

export function createQuestion(input: QuestionInput): Result<Question, ValidationError> {
  const prompt = requiredText('prompt', input.prompt, 2000);
  if (!prompt.ok) return prompt;
  const points = input.points ?? defaultQuestionPoints;
  if (!(points > 0) || !Number.isFinite(points)) return invalid('points', 'out_of_range');
  const instructions = optionalText('instructions', input.instructions, 2000);
  if (!instructions.ok) return instructions;
  const body = validateBody(input.type, input);
  if (!body.ok) return body;

  return ok({
    type: input.type,
    id: input.id,
    prompt: prompt.value,
    points,
    instructions: instructions.value,
    ...body.value,
  } as Question);
}
