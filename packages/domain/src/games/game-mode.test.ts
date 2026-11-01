import { describe, expect, it } from 'vitest';
import type { ContentOf, GameContent } from './content.ts';
import { defineMode, gridLetters, listOf, sameAnswer } from './game-mode.ts';

const steps: GameContent = { kind: 'steps', items: ['One', 'Two', 'Three'] };
const pairs: ContentOf<'pairs'> = {
  kind: 'pairs',
  items: [
    { term: 'Sun', definition: 'A star' },
    { term: 'Moon', definition: 'A satellite' },
    { term: 'Mars', definition: 'The red planet' },
    { term: 'Comet', definition: 'Has a tail' },
  ],
};

const echo = defineMode({
  id: 'echo',
  kind: 'steps',
  prepare: (content, random) => ({
    view: { mode: 'echo', first: content.items[0] ?? '', roll: random() },
    key: content.items.length,
  }),
  solve: (key) => key,
  score: (key, answers) => ({
    score: answers === key ? 1 : 0,
    total: 1,
    results: [answers === key],
  }),
});

const asking = defineMode({
  id: 'asking',
  kind: 'questions',
  prepare: (content) => ({ view: { mode: 'asking', items: content.items }, key: 0 }),
  solve: () => null,
  score: () => ({ score: 0, total: 0, results: [] }),
});

describe('defineMode', () => {
  it('rebuilds the same round from the same seed', () => {
    expect(echo.prepare(steps, 5)).toEqual(echo.prepare(steps, 5));
    expect(echo.prepare(steps, 5)).not.toEqual(echo.prepare(steps, 6));
  });

  it('scores against the key rebuilt from the seed', () => {
    expect(echo.score(steps, 5, echo.solve(steps, 5))).toEqual({
      score: 1,
      total: 1,
      results: [true],
    });
    expect(echo.score(steps, 5, 'nonsense').score).toBe(0);
  });

  it('plays its own kind, and pairs become questions for a questions mode', () => {
    expect([echo.plays('steps'), echo.plays('pairs')]).toEqual([true, false]);
    expect(asking.plays('pairs')).toBe(true);

    const view = asking.prepare(pairs, 1);
    expect(view.items).toHaveLength(4);
    for (const item of view.items) {
      const pair = pairs.items.find((p) => p.term === item.prompt);
      expect(item.options).toHaveLength(4);
      expect(item.options[item.answer]).toBe(pair?.definition);
    }
  });

  it('refuses content it cannot play (a programmer error)', () => {
    expect(() => echo.prepare(pairs, 1)).toThrow('echo cannot play pairs');
  });

  it('has no extra rules unless the mode adds some', () => {
    expect(echo.unsuitable(steps)).toBeNull();
  });
});

describe('answer helpers', () => {
  it('reads a list, or nothing from malformed answers', () => {
    expect(listOf([1, 2])).toEqual([1, 2]);
    expect(listOf('x')).toEqual([]);
    expect(listOf(null)).toEqual([]);
  });

  it('compares typed answers ignoring case, accents, spaces and end punctuation', () => {
    expect(sameAnswer(' JÚPITER. ', 'jupiter')).toBe(true);
    expect(sameAnswer('photo  synthesis', 'photo synthesis')).toBe(true);
    expect(sameAnswer('Mars', 'Venus')).toBe(false);
    expect(sameAnswer(7, '7')).toBe(false);
  });

  it('turns a term into upper-case grid letters, any script', () => {
    expect(gridLetters('Solar system')).toEqual('SOLARSYSTEM'.split(''));
    expect(gridLetters('año-luz')).toEqual(['A', 'Ñ', 'O', 'L', 'U', 'Z']);
    expect(gridLetters('太阳')).toEqual(['太', '阳']);
  });
});
