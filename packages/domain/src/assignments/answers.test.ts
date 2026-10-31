import { describe, expect, it } from 'vitest';
import { createQuestion, type Question } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';
import { autoScore, isOpenQuestion, normalizeBlank, parseAnswer } from './answers.ts';
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
  points: 4,
});
const tf = question({ type: 'true_false', prompt: 'Sky is blue', answer: true, points: 2 });
const blank = question({
  type: 'fill_blank',
  prompt: 'The ___ rises in the east.',
  acceptedAnswers: ['sun', 'the sun'],
  points: 3,
});
const matching = question({
  type: 'matching',
  prompt: 'Match',
  pairs: [
    { left: 'dog', right: 'perro' },
    { left: 'cat', right: 'gato' },
    { left: 'bird', right: 'pájaro' },
    { left: 'fish', right: 'pez' },
  ],
  points: 8,
});
const short = question({ type: 'short_answer', prompt: 'Why?', modelAnswer: 'Because' });
const essay = question({ type: 'essay', prompt: 'Write', rubric: 'Clear ideas' });

describe('parseAnswer', () => {
  it('accepts a blank answer for any type, as unanswered', () => {
    for (const q of [mc, tf, blank, matching, short, essay]) {
      expect(parseAnswer(q, undefined)).toEqual({ ok: true, value: null });
      expect(parseAnswer(q, '  ')).toEqual({ ok: true, value: null });
    }
  });

  it('accepts an option index in range for multiple choice', () => {
    expect(parseAnswer(mc, '2')).toEqual({ ok: true, value: '2' });
    expect(parseAnswer(mc, '3')).toEqual({
      ok: false,
      error: { field: 'q1', code: 'out_of_range' },
    });
    expect(parseAnswer(mc, 'blue')).toEqual({
      ok: false,
      error: { field: 'q1', code: 'invalid_format' },
    });
  });

  it('accepts only true or false for true/false', () => {
    expect(parseAnswer(tf, 'false')).toEqual({ ok: true, value: 'false' });
    expect(parseAnswer(tf, 'maybe').ok).toBe(false);
  });

  it('trims written answers and limits their length (essays may be longer)', () => {
    expect(parseAnswer(short, ' Because of the rain ')).toEqual({
      ok: true,
      value: 'Because of the rain',
    });
    expect(parseAnswer(short, 'x'.repeat(2001))).toEqual({
      ok: false,
      error: { field: 'q1', code: 'too_long' },
    });
    expect(parseAnswer(essay, 'x'.repeat(10_000)).ok).toBe(true);
    expect(parseAnswer(essay, 'x'.repeat(10_001)).ok).toBe(false);
  });

  it('accepts a matching answer that maps known left items to known right items', () => {
    const answer = JSON.stringify({ dog: 'perro', cat: 'pez' });
    expect(parseAnswer(matching, answer)).toEqual({ ok: true, value: answer });
    expect(parseAnswer(matching, JSON.stringify({ wolf: 'perro' })).ok).toBe(false);
    expect(parseAnswer(matching, JSON.stringify({ dog: 'lobo' })).ok).toBe(false);
    expect(parseAnswer(matching, '[1,2]').ok).toBe(false);
    expect(parseAnswer(matching, 'not json').ok).toBe(false);
  });
});

describe('normalizeBlank', () => {
  it('ignores case, extra spaces and ending punctuation', () => {
    expect(normalizeBlank('  The   SUN. ')).toBe('the sun');
  });
});

describe('autoScore', () => {
  it('scores multiple choice and true/false all or nothing', () => {
    expect(autoScore(mc, '1')).toBe(4);
    expect(autoScore(mc, '0')).toBe(0);
    expect(autoScore(tf, 'true')).toBe(2);
    expect(autoScore(tf, 'false')).toBe(0);
  });

  it('accepts any accepted blank answer, ignoring case and spacing', () => {
    expect(autoScore(blank, 'Sun')).toBe(3);
    expect(autoScore(blank, ' the  sun ')).toBe(3);
    expect(autoScore(blank, 'moon')).toBe(0);
  });

  it('gives matching proportional credit per correct pair', () => {
    expect(autoScore(matching, JSON.stringify({ dog: 'perro', cat: 'gato', bird: 'pez' }))).toBe(4);
    expect(
      autoScore(
        matching,
        JSON.stringify({ dog: 'perro', cat: 'gato', bird: 'pájaro', fish: 'pez' }),
      ),
    ).toBe(8);
  });

  it('scores an unanswered objective question as zero', () => {
    expect(autoScore(mc, null)).toBe(0);
    expect(autoScore(matching, null)).toBe(0);
  });

  it('leaves short answers and essays to the teacher or the AI', () => {
    expect(autoScore(short, 'Because')).toBeNull();
    expect(autoScore(essay, 'An essay')).toBeNull();
    expect([mc, tf, blank, matching, short, essay].map(isOpenQuestion)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });
});
