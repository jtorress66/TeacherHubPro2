import { describe, expect, it } from 'vitest';
import { type QuestionId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createQuestion, questionTypes } from './question.ts';

const id = 'q1' as QuestionId;

describe('createQuestion', () => {
  it('supports the six question types of the original app', () => {
    expect([...questionTypes]).toEqual([
      'multiple_choice',
      'true_false',
      'fill_blank',
      'short_answer',
      'matching',
      'essay',
    ]);
  });

  it('defaults to 10 points and no instructions, like the original app', () => {
    expect(
      valueOf(
        createQuestion({ type: 'true_false', id, prompt: ' The sun is a star ', answer: true }),
      ),
    ).toEqual({
      type: 'true_false',
      id,
      prompt: 'The sun is a star',
      points: 10,
      instructions: null,
      answer: true,
    });
  });

  it('creates a multiple-choice question with a valid correct option', () => {
    const question = valueOf(
      createQuestion({
        type: 'multiple_choice',
        id,
        prompt: '2 + 2?',
        points: 5,
        instructions: 'Choose one',
        options: ['3', '4'],
        correctOption: 1,
      }),
    );
    expect(question).toMatchObject({ points: 5, instructions: 'Choose one', correctOption: 1 });
  });

  it('rejects multiple choice with fewer than two options or a correct option out of range', () => {
    const base = { type: 'multiple_choice' as const, id, prompt: '?' };
    expect(errorOf(createQuestion({ ...base, options: ['a'], correctOption: 0 }))).toEqual({
      field: 'options',
      code: 'required',
    });
    expect(errorOf(createQuestion({ ...base, options: ['a', ' '], correctOption: 0 }))).toEqual({
      field: 'options',
      code: 'required',
    });
    expect(errorOf(createQuestion({ ...base, options: ['a', 'b'], correctOption: 2 }))).toEqual({
      field: 'correctOption',
      code: 'out_of_range',
    });
  });

  it('a fill-in-the-blank question needs at least one accepted answer', () => {
    expect(
      valueOf(
        createQuestion({
          type: 'fill_blank',
          id,
          prompt: 'The capital is __',
          acceptedAnswers: [' Paris '],
        }),
      ),
    ).toMatchObject({ acceptedAnswers: ['Paris'] });
    expect(
      errorOf(createQuestion({ type: 'fill_blank', id, prompt: 'x __', acceptedAnswers: ['  '] })),
    ).toEqual({
      field: 'acceptedAnswers',
      code: 'required',
    });
  });

  it('a matching question needs two complete pairs with distinct left items', () => {
    const base = { type: 'matching' as const, id, prompt: 'Match' };
    expect(
      valueOf(
        createQuestion({
          ...base,
          pairs: [
            { left: 'H2O', right: 'water' },
            { left: 'NaCl', right: 'salt' },
          ],
        }),
      ),
    ).toMatchObject({
      pairs: [
        { left: 'H2O', right: 'water' },
        { left: 'NaCl', right: 'salt' },
      ],
    });
    expect(errorOf(createQuestion({ ...base, pairs: [{ left: 'a', right: 'b' }] }))).toEqual({
      field: 'pairs',
      code: 'required',
    });
    expect(
      errorOf(
        createQuestion({
          ...base,
          pairs: [
            { left: 'a', right: 'b' },
            { left: 'c', right: ' ' },
          ],
        }),
      ),
    ).toEqual({ field: 'pairs', code: 'required' });
    expect(
      errorOf(
        createQuestion({
          ...base,
          pairs: [
            { left: 'a', right: 'b' },
            { left: 'a', right: 'c' },
          ],
        }),
      ),
    ).toEqual({ field: 'pairs', code: 'duplicate' });
  });

  it('short answer and essay questions keep an optional model answer or rubric', () => {
    expect(valueOf(createQuestion({ type: 'short_answer', id, prompt: 'Why?' }))).toMatchObject({
      modelAnswer: null,
    });
    expect(
      valueOf(createQuestion({ type: 'essay', id, prompt: 'Discuss', rubric: 'Thesis, evidence' })),
    ).toMatchObject({ rubric: 'Thesis, evidence' });
  });

  it('rejects an over-long model answer or rubric', () => {
    const long = 'x'.repeat(2001);
    expect(
      errorOf(createQuestion({ type: 'short_answer', id, prompt: 'Why?', modelAnswer: long })),
    ).toEqual({
      field: 'modelAnswer',
      code: 'too_long',
    });
    expect(errorOf(createQuestion({ type: 'essay', id, prompt: 'Discuss', rubric: long }))).toEqual(
      {
        field: 'rubric',
        code: 'too_long',
      },
    );
  });

  it('rejects a blank prompt and points that are not positive', () => {
    expect(errorOf(createQuestion({ type: 'essay', id, prompt: ' ' }))).toEqual({
      field: 'prompt',
      code: 'required',
    });
    for (const points of [0, -1, Number.NaN]) {
      expect(errorOf(createQuestion({ type: 'essay', id, prompt: 'x', points }))).toEqual({
        field: 'points',
        code: 'out_of_range',
      });
    }
  });

  it('rejects over-long instructions', () => {
    expect(
      errorOf(createQuestion({ type: 'essay', id, prompt: 'x', instructions: 'i'.repeat(2001) })),
    ).toEqual({ field: 'instructions', code: 'too_long' });
  });
});
