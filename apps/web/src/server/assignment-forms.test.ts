import { describe, expect, it } from 'vitest';
import { parseAnswersForm, parseQuestionsJson, studentLinkUrl } from './assignment-forms.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('parseQuestionsJson', () => {
  it('reads every question type from the builder, keeping only known fields', () => {
    const json = JSON.stringify([
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Pick',
        options: ['a', 'b'],
        correctOption: 1,
        points: 4,
        extra: 1,
      },
      { id: 'q2', type: 'true_false', prompt: 'True?', answer: false, instructions: 'Read' },
      { id: 'q3', type: 'fill_blank', prompt: 'The ___', acceptedAnswers: ['sun'] },
      { id: 'q4', type: 'short_answer', prompt: 'Why?', modelAnswer: null },
      { id: 'q5', type: 'matching', prompt: 'Match', pairs: [{ left: 'a', right: 'b' }] },
      { id: 'q6', type: 'essay', prompt: 'Write', rubric: 'Clear' },
    ]);
    const questions = parseQuestionsJson(json);
    expect(questions?.map((q) => q.type)).toEqual([
      'multiple_choice',
      'true_false',
      'fill_blank',
      'short_answer',
      'matching',
      'essay',
    ]);
    expect(questions?.[0]).toEqual({
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Pick',
      options: ['a', 'b'],
      correctOption: 1,
      points: 4,
    });
    expect(questions?.[1]).toMatchObject({ answer: false, instructions: 'Read' });
  });

  it('returns null for anything that is not a list of questions', () => {
    expect(parseQuestionsJson('nope')).toBeNull();
    expect(parseQuestionsJson('{}')).toBeNull();
    expect(parseQuestionsJson('[{"id":"q1","type":"drawing","prompt":"x"}]')).toBeNull();
    expect(parseQuestionsJson('[{"id":"q1","type":"true_false","prompt":"x"}]')).toBeNull();
  });
});

describe('parseAnswersForm', () => {
  it('reads each answer by question id, and matching dropdowns into one answer', () => {
    const answers = parseAnswersForm(
      form([
        ['q.q1', '1'],
        ['q.q2', ' Because '],
        ['m.q3.dog', 'perro'],
        ['m.q3.cat', ''],
        ['m.q3.bird', 'pájaro'],
        ['locale', 'es'],
      ]),
    );
    expect(answers).toEqual({
      q1: '1',
      q2: ' Because ',
      q3: JSON.stringify({ dog: 'perro', bird: 'pájaro' }),
    });
  });
});

describe('studentLinkUrl', () => {
  it('builds the student’s personal address in the page’s language', () => {
    expect(studentLinkUrl('https://app.test', 'es', 'abc123')).toBe('https://app.test/es/s/abc123');
  });
});
