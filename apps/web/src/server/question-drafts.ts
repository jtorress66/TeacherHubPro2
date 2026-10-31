import {
  defaultQuestionPoints,
  type Question,
  type QuestionId,
  type QuestionInput,
  type QuestionType,
} from '@thp/domain';

/** A question as the builder edits it: lists and pairs as lines of text. */
export interface QuestionDraft {
  readonly id: string;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly points: string;
  readonly instructions: string;
  readonly optionsText: string;
  readonly correctOption: number;
  readonly answer: boolean;
  readonly acceptedText: string;
  readonly modelAnswer: string;
  readonly pairsText: string;
  readonly rubric: string;
}

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

export const blankDraft = (type: QuestionType, id: string): QuestionDraft => ({
  id,
  type,
  prompt: '',
  points: String(defaultQuestionPoints),
  instructions: '',
  optionsText: '',
  correctOption: 0,
  answer: true,
  acceptedText: '',
  modelAnswer: '',
  pairsText: '',
  rubric: '',
});

type QuestionOf<T extends QuestionType> = Extract<Question, { type: T }>;

/** What each type keeps in the draft's text fields. A new type adds an entry here. */
const fields: { readonly [T in QuestionType]: (q: QuestionOf<T>) => Partial<QuestionDraft> } = {
  multiple_choice: (q) => ({ optionsText: q.options.join('\n'), correctOption: q.correctOption }),
  true_false: (q) => ({ answer: q.answer }),
  fill_blank: (q) => ({ acceptedText: q.acceptedAnswers.join('\n') }),
  short_answer: (q) => ({ modelAnswer: q.modelAnswer ?? '' }),
  matching: (q) => ({ pairsText: q.pairs.map((p) => `${p.left} = ${p.right}`).join('\n') }),
  essay: (q) => ({ rubric: q.rubric ?? '' }),
};

export function draftOf(question: Question): QuestionDraft {
  const fieldsOf = fields[question.type] as (q: Question) => Partial<QuestionDraft>;
  return {
    ...blankDraft(question.type, question.id),
    prompt: question.prompt,
    points: String(question.points),
    instructions: question.instructions ?? '',
    ...fieldsOf(question),
  };
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** What each type adds from the draft. A new type adds an entry here. */
const bodies: Readonly<Record<QuestionType, (d: QuestionDraft) => Record<string, unknown>>> = {
  multiple_choice: (d) => ({ options: lines(d.optionsText), correctOption: d.correctOption }),
  true_false: (d) => ({ answer: d.answer }),
  fill_blank: (d) => ({ acceptedAnswers: lines(d.acceptedText) }),
  short_answer: (d) => ({ modelAnswer: orNull(d.modelAnswer) }),
  matching: (d) => ({
    pairs: lines(d.pairsText).flatMap((line) => {
      const at = line.indexOf('=');
      return at === -1
        ? []
        : [{ left: line.slice(0, at).trim(), right: line.slice(at + 1).trim() }];
    }),
  }),
  essay: (d) => ({ rubric: orNull(d.rubric) }),
};

export function inputOf(draft: QuestionDraft): QuestionInput {
  const points = Number(draft.points);
  return {
    id: draft.id as QuestionId,
    type: draft.type,
    prompt: draft.prompt,
    instructions: orNull(draft.instructions),
    ...(draft.points.trim() === '' || !Number.isFinite(points) ? {} : { points }),
    ...bodies[draft.type](draft),
  } as QuestionInput;
}

/** `q<n>` one above the highest numbered id. */
export function nextQuestionId(questions: readonly { readonly id: string }[]): string {
  const numbers = questions.map((q) => /^q(\d+)$/.exec(q.id)?.[1]).filter((n) => n !== undefined);
  return `q${String(Math.max(0, ...numbers.map(Number)) + 1)}`;
}
