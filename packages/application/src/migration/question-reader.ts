import {
  createQuestion,
  questionTypes,
  type Question,
  type QuestionId,
  type QuestionInput,
  type QuestionType,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { number, record, records, strings, text } from './legacy-fields.ts';

const letters = 'abcdefghij';

/** The index of the right option: flagged `is_correct`, or named by `correct_answer` (text or letter). */
function correctOption(doc: LegacyDocument, options: readonly LegacyDocument[]): number {
  const flagged = options.findIndex((option) => option.is_correct === true);
  if (flagged >= 0) return flagged;
  const answer = text(doc, 'correct_answer')?.toLowerCase() ?? '';
  const byText = options.findIndex((option) => text(option, 'text')?.toLowerCase() === answer);
  if (byText >= 0) return byText;
  return answer.length === 1 ? letters.indexOf(answer) : -1;
}

const truthy = ['true', 'verdadero', 'cierto', 't', 'v'];

/** What each question type adds to the common fields. */
type Body<T extends QuestionType> = Omit<
  Extract<QuestionInput, { readonly type: T }>,
  'id' | 'prompt' | 'points' | 'type' | 'instructions'
>;

const bodies: { [T in QuestionType]: (doc: LegacyDocument) => Body<T> } = {
  multiple_choice: (doc) => {
    const options = records(doc, 'options');
    const texts =
      options.length > 0 ? options.map((o) => text(o, 'text') ?? '') : strings(doc, 'options');
    return { options: texts, correctOption: correctOption(doc, options) };
  },
  true_false: (doc) => ({
    answer: truthy.includes(text(doc, 'correct_answer')?.toLowerCase() ?? ''),
  }),
  fill_blank: (doc) => ({ acceptedAnswers: [text(doc, 'correct_answer') ?? ''] }),
  short_answer: (doc) => ({ modelAnswer: text(doc, 'correct_answer') }),
  matching: (doc) => ({
    pairs: Object.entries(record(doc, 'matching_pairs') ?? {}).map(([left, right]) => ({
      left,
      right: typeof right === 'string' ? right : '',
    })),
  }),
  essay: (doc) => ({ rubric: strings(doc, 'rubric_criteria').join('\n') || null }),
};

const isType = (value: string | null): value is QuestionType =>
  (questionTypes as readonly (string | null)[]).includes(value);

/** An old question in the new shape; null when the new rules cannot take it. */
export function readQuestion(doc: LegacyDocument, index: number): Question | null {
  const type = text(doc, 'question_type');
  if (!isType(type)) return null;
  const points = number(doc, 'points');
  const question = createQuestion({
    type,
    id: (text(doc, 'question_id') ?? `q${String(index + 1)}`) as QuestionId,
    prompt: text(doc, 'question_text') ?? '',
    ...(points === null ? {} : { points }),
    ...bodies[type](doc),
  } as QuestionInput);
  return question.ok ? question.value : null;
}
