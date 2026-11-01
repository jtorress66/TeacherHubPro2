import { describe, expect, it } from 'vitest';
import { errorOf, valueOf } from '../test-support.ts';
import { validateContent, type GameContent } from './content.ts';

const questions: GameContent = {
  kind: 'questions',
  items: [
    { prompt: 'Largest planet?', options: ['Mars', 'Jupiter', 'Venus'], answer: 1 },
    { prompt: 'Closest to the Sun?', options: ['Mercury', 'Earth'], answer: 0 },
    { prompt: 'The red planet?', options: ['Saturn', 'Mars', 'Neptune', 'Uranus'], answer: 1 },
  ],
};

const pairs: GameContent = {
  kind: 'pairs',
  items: [
    { term: 'Sun', definition: 'The star at the centre' },
    { term: 'Moon', definition: 'Earth’s natural satellite' },
    { term: 'Comet', definition: 'Ice that grows a tail' },
    { term: 'Orbit', definition: 'A curved path around a body' },
  ],
};

describe('validateContent', () => {
  it('accepts good content and trims its text', () => {
    const padded: GameContent = {
      kind: 'steps',
      items: ['  Plant the seed ', 'Water it', 'Watch it grow'],
    };
    expect(valueOf(validateContent(padded))).toEqual({
      kind: 'steps',
      items: ['Plant the seed', 'Water it', 'Watch it grow'],
    });
    expect(valueOf(validateContent(questions))).toEqual(questions);
  });

  it('needs enough items for each kind', () => {
    expect(errorOf(validateContent({ ...questions, items: questions.items.slice(0, 2) }))).toEqual({
      field: 'items',
      code: 'too_short',
    });
    expect(errorOf(validateContent({ ...pairs, items: pairs.items.slice(0, 3) }))).toEqual({
      field: 'items',
      code: 'too_short',
    });
    expect(
      errorOf(
        validateContent({ kind: 'groups', items: [{ name: 'Mammals', members: ['Cat', 'Dog'] }] }),
      ),
    ).toEqual({ field: 'items', code: 'too_short' });
  });

  it('allows at most 30 items', () => {
    const many = Array.from({ length: 31 }, (_, i) => `Step ${String(i)}`);
    expect(errorOf(validateContent({ kind: 'steps', items: many }))).toEqual({
      field: 'items',
      code: 'too_long',
    });
  });

  it('rejects placeholder text anywhere, in any case', () => {
    for (const filler of [
      'TODO',
      'Lorem ipsum dolor',
      'your answer here',
      'Option A',
      '[insert]',
    ]) {
      const item = { prompt: filler, options: ['Mars', 'Earth'], answer: 0 };
      expect(errorOf(validateContent({ ...questions, items: [...questions.items, item] }))).toEqual(
        {
          field: 'items.3',
          code: 'not_allowed',
        },
      );
    }
  });

  it('a question needs 2 to 6 different options and a correct answer among them', () => {
    const withItem = (item: { prompt: string; options: string[]; answer: number }) =>
      validateContent({ ...questions, items: [...questions.items, item] });

    expect(errorOf(withItem({ prompt: 'Biggest?', options: ['Mars'], answer: 0 }))).toEqual({
      field: 'items.3.options',
      code: 'too_short',
    });
    const seven = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];
    expect(errorOf(withItem({ prompt: 'Biggest?', options: seven, answer: 0 }))).toEqual({
      field: 'items.3.options',
      code: 'too_long',
    });
    expect(
      errorOf(withItem({ prompt: 'Biggest?', options: ['Mars', ' mars'], answer: 0 })),
    ).toEqual({ field: 'items.3.options', code: 'duplicate' });
    expect(
      errorOf(withItem({ prompt: 'Biggest?', options: ['Mars', 'Earth'], answer: 2 })),
    ).toEqual({ field: 'items.3.answer', code: 'out_of_range' });
    expect(errorOf(withItem({ prompt: 'Biggest?', options: ['Mars', ''], answer: 0 }))).toEqual({
      field: 'items.3.options',
      code: 'required',
    });
  });

  it('a statement needs text and a true or false answer', () => {
    const statements: GameContent = {
      kind: 'statements',
      items: [
        { statement: 'The Sun is a star', isTrue: true },
        { statement: 'The Moon is a planet', isTrue: false },
        { statement: '  ', isTrue: true },
      ],
    };
    expect(errorOf(validateContent(statements))).toEqual({ field: 'items.2', code: 'required' });
  });

  it('a sentence has exactly one blank, and its answer is not already in it', () => {
    const sentences = (text: string, answer = 'Jupiter'): GameContent => ({
      kind: 'sentences',
      items: [
        { text: 'The Sun is a ___.', answer: 'star' },
        { text: '___ is the red planet.', answer: 'Mars' },
        { text, answer },
      ],
    });

    expect(valueOf(validateContent(sentences('___ is the largest planet.'))).items).toHaveLength(3);
    expect(errorOf(validateContent(sentences('Jupiter is the largest planet.')))).toEqual({
      field: 'items.2.text',
      code: 'invalid_format',
    });
    expect(errorOf(validateContent(sentences('___ and ___ are planets.')))).toEqual({
      field: 'items.2.text',
      code: 'invalid_format',
    });
    expect(errorOf(validateContent(sentences('___, also called Jupiter, is big.')))).toEqual({
      field: 'items.2.answer',
      code: 'not_allowed',
    });
    expect(errorOf(validateContent(sentences('___ is big.', ' ')))).toEqual({
      field: 'items.2.answer',
      code: 'required',
    });
  });

  it('pairs need different terms', () => {
    const duplicate = { term: ' sun', definition: 'Again' };
    expect(errorOf(validateContent({ ...pairs, items: [...pairs.items, duplicate] }))).toEqual({
      field: 'items.4.term',
      code: 'duplicate',
    });
    expect(
      errorOf(
        validateContent({ ...pairs, items: [...pairs.items, { term: 'Star', definition: '' }] }),
      ),
    ).toEqual({ field: 'items.4.definition', code: 'required' });
  });

  it('steps must all be different', () => {
    expect(errorOf(validateContent({ kind: 'steps', items: ['Mix', 'Bake', 'mix'] }))).toEqual({
      field: 'items.2',
      code: 'duplicate',
    });
  });

  it('groups need names, two or more members each, and no member in two groups', () => {
    const groups = (second: { name: string; members: string[] }): GameContent => ({
      kind: 'groups',
      items: [{ name: 'Mammals', members: ['Cat', 'Dog'] }, second],
    });

    expect(valueOf(validateContent(groups({ name: 'Birds', members: ['Owl', 'Hen'] }))).kind).toBe(
      'groups',
    );
    expect(errorOf(validateContent(groups({ name: 'Birds', members: ['Owl'] })))).toEqual({
      field: 'items.1.members',
      code: 'too_short',
    });
    expect(errorOf(validateContent(groups({ name: 'Birds', members: ['Owl', 'cat'] })))).toEqual({
      field: 'items.1.members',
      code: 'duplicate',
    });
    expect(errorOf(validateContent(groups({ name: 'mammals', members: ['Owl', 'Hen'] })))).toEqual({
      field: 'items.1.name',
      code: 'duplicate',
    });
    expect(errorOf(validateContent(groups({ name: '', members: ['Owl', 'Hen'] })))).toEqual({
      field: 'items.1.name',
      code: 'required',
    });
  });

  it('rejects over-long text', () => {
    const long = 'x'.repeat(301);
    expect(errorOf(validateContent({ kind: 'steps', items: ['Mix', 'Bake', long] }))).toEqual({
      field: 'items.2',
      code: 'too_long',
    });
  });
});
