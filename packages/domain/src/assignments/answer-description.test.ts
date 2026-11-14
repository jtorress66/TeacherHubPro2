import { describe, expect, it } from 'vitest';
import { createQuestion, type Question } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';
import { describeAnswer, optionLetter } from './answer-description.ts';
import type { ExtractedQuestionInput } from './extracted-test.ts';

const question = (input: ExtractedQuestionInput): Question => {
  const created = createQuestion({ id: 'q1' as QuestionId, ...input });
  if (!created.ok) throw new Error(created.error.field);
  return created.value;
};

const mc = question({
  type: 'multiple_choice',
  prompt: 'Pick one',
  options: ['red', 'blue', 'green'],
  correctOption: 1,
});
const tf = question({ type: 'true_false', prompt: 'Sky is blue', answer: true });
const blank = question({
  type: 'fill_blank',
  prompt: 'The ___ rises in the east.',
  acceptedAnswers: ['sun', 'the sun'],
});
const matching = question({
  type: 'matching',
  prompt: 'Match',
  pairs: [
    { left: 'dog', right: 'perro' },
    { left: 'cat', right: 'gato' },
    { left: 'bird', right: 'pájaro' },
  ],
});
const short = question({ type: 'short_answer', prompt: 'Why?', modelAnswer: 'Because' });
const essay = question({ type: 'essay', prompt: 'Write', rubric: 'Clear ideas' });

describe('optionLetter', () => {
  it('letters options A, B, C… and numbers any past Z', () => {
    expect([0, 1, 2, 25].map(optionLetter)).toEqual(['A', 'B', 'C', 'Z']);
    expect(optionLetter(26)).toBe('27');
  });
});

describe('describeAnswer', () => {
  it('says nothing was answered for a missing or blank answer', () => {
    expect(describeAnswer(mc, undefined)).toEqual({ kind: 'unanswered' });
    expect(describeAnswer(essay, '   ')).toEqual({ kind: 'unanswered' });
  });

  it('shows a right multiple-choice answer by letter and option text', () => {
    expect(describeAnswer(mc, '1')).toEqual({
      kind: 'choice',
      letter: 'B',
      text: 'blue',
      correct: true,
      correctLetter: 'B',
      correctText: 'blue',
    });
  });

  it('shows a wrong multiple-choice answer with the correct option', () => {
    expect(describeAnswer(mc, '2')).toEqual({
      kind: 'choice',
      letter: 'C',
      text: 'green',
      correct: false,
      correctLetter: 'B',
      correctText: 'blue',
    });
  });

  it('shows an out-of-range or malformed option as the raw text it was stored as', () => {
    expect(describeAnswer(mc, '7')).toEqual({ kind: 'text', text: '7' });
    expect(describeAnswer(mc, '<b>1</b>')).toEqual({ kind: 'text', text: '<b>1</b>' });
  });

  it('reads true/false as a value and whether it was right', () => {
    expect(describeAnswer(tf, 'true')).toEqual({ kind: 'truefalse', value: true, correct: true });
    expect(describeAnswer(tf, 'false')).toEqual({
      kind: 'truefalse',
      value: false,
      correct: false,
    });
    expect(describeAnswer(tf, 'maybe')).toEqual({ kind: 'text', text: 'maybe' });
  });

  it('shows a blank as written, right as it is scored, with the accepted answers', () => {
    expect(describeAnswer(blank, 'The Sun.')).toEqual({
      kind: 'blank',
      text: 'The Sun.',
      correct: true,
      accepted: ['sun', 'the sun'],
    });
    expect(describeAnswer(blank, 'moon')).toEqual({
      kind: 'blank',
      text: 'moon',
      correct: false,
      accepted: ['sun', 'the sun'],
    });
  });

  it('lists every matching pair in the question’s order, unmatched ones with no right side', () => {
    expect(describeAnswer(matching, JSON.stringify({ cat: 'gato', dog: 'gato' }))).toEqual({
      kind: 'matching',
      pairs: [
        { left: 'dog', right: 'gato', correct: false },
        { left: 'cat', right: 'gato', correct: true },
        { left: 'bird', right: null, correct: false },
      ],
    });
  });

  it('shows malformed matching answers as raw text and ignores non-text right sides', () => {
    expect(describeAnswer(matching, '{not json')).toEqual({ kind: 'text', text: '{not json' });
    expect(describeAnswer(matching, '["dog"]')).toEqual({ kind: 'text', text: '["dog"]' });
    expect(describeAnswer(matching, JSON.stringify({ dog: 3 }))).toEqual({
      kind: 'matching',
      pairs: [
        { left: 'dog', right: null, correct: false },
        { left: 'cat', right: null, correct: false },
        { left: 'bird', right: null, correct: false },
      ],
    });
  });

  it('shows written answers as they are', () => {
    expect(describeAnswer(short, 'Because it turns')).toEqual({
      kind: 'text',
      text: 'Because it turns',
    });
    expect(describeAnswer(essay, 'Once upon a time')).toEqual({
      kind: 'text',
      text: 'Once upon a time',
    });
  });
});
