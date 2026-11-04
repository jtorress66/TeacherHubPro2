import { describe, expect, it } from 'vitest';
import type { GameId, SchoolId, UserId } from '../shared/ids.ts';
import { valueOf } from '../test-support.ts';
import type { GameContent } from '../games/content.ts';
import { createGame, type Game } from '../games/game.ts';
import { defaultGameModes } from '../games/mode-registry.ts';
import { isCorrectLiveAnswer, liveModes, liveQuestions } from './live-questions.ts';

const questions: GameContent = {
  kind: 'questions',
  items: [
    { prompt: 'Largest planet?', options: ['Mars', 'Jupiter', 'Venus'], answer: 1 },
    { prompt: 'Closest to the Sun?', options: ['Mercury', 'Earth'], answer: 0 },
    { prompt: 'The red planet?', options: ['Saturn', 'Mars'], answer: 1 },
  ],
};
const statementItems = [
  { statement: 'The Sun is a star', isTrue: true },
  { statement: 'The Moon is a planet', isTrue: false },
  { statement: 'Mars is red', isTrue: true },
];
const statements: GameContent = {
  kind: 'statements',
  items: statementItems,
};
const pairs: GameContent = {
  kind: 'pairs',
  items: [
    { term: 'Sun', definition: 'Our star' },
    { term: 'Moon', definition: 'Earth’s satellite' },
    { term: 'Comet', definition: 'Icy body with a tail' },
    { term: 'Orbit', definition: 'Path around a body' },
  ],
};

const gameOf = (content: GameContent, mode: string): Game =>
  valueOf(
    createGame(
      {
        id: 'g' as GameId,
        schoolId: 's' as SchoolId,
        teacherId: 't' as UserId,
        title: 'Space',
        mode,
        content,
        createdAt: new Date(0),
      },
      defaultGameModes,
    ),
  );

/** The right choice for each live question, found by trying every option. */
const rightChoices = (game: Game, mode: string, seed: number) =>
  (liveQuestions(game, mode, seed, defaultGameModes) ?? []).map((q, i) =>
    q.options.findIndex((_, c) => isCorrectLiveAnswer(game, mode, seed, i, c, defaultGameModes)),
  );

describe('liveModes', () => {
  it('offers the question modes a game can be played in', () => {
    expect(liveModes(gameOf(questions, 'quiz'), defaultGameModes)).toEqual(['quiz']);
    expect(liveModes(gameOf(statements, 'true_false'), defaultGameModes)).toEqual(['true_false']);
    expect(liveModes(gameOf(pairs, 'all'), defaultGameModes)).toEqual(['quiz']);
    expect(liveModes(gameOf(pairs, 'matching'), defaultGameModes)).toEqual([]);
  });
});

describe('liveQuestions', () => {
  it('shows each quiz question with its options and no answer', () => {
    const shown = liveQuestions(gameOf(questions, 'quiz'), 'quiz', 3, defaultGameModes) ?? [];
    expect(shown.map((q) => q.prompt).sort()).toEqual([
      'Closest to the Sun?',
      'Largest planet?',
      'The red planet?',
    ]);
    expect(shown.every((q) => q.style === 'choices')).toBe(true);
    expect(JSON.stringify(shown)).not.toContain('answer');
  });

  it('shows true/false statements with a true and a false choice', () => {
    const shown = liveQuestions(
      gameOf(statements, 'true_false'),
      'true_false',
      1,
      defaultGameModes,
    );
    expect(shown?.[0]).toMatchObject({ style: 'true_false', options: ['true', 'false'] });
  });

  it('asks each term of a pairs game with four definitions', () => {
    const shown = liveQuestions(gameOf(pairs, 'all'), 'quiz', 2, defaultGameModes) ?? [];
    expect(shown).toHaveLength(4);
    expect(shown.every((q) => q.options.length === 4)).toBe(true);
  });

  it('is the same for the same seed, and has nothing for a mode that cannot run live', () => {
    const game = gameOf(questions, 'quiz');
    expect(liveQuestions(game, 'quiz', 9, defaultGameModes)).toEqual(
      liveQuestions(game, 'quiz', 9, defaultGameModes),
    );
    expect(liveQuestions(gameOf(pairs, 'all'), 'matching', 9, defaultGameModes)).toBeNull();
    expect(liveQuestions(game, 'true_false', 9, defaultGameModes)).toBeNull();
  });
});

describe('isCorrectLiveAnswer', () => {
  it('judges a choice with the mode’s own rules: exactly one right choice per question', () => {
    for (const [content, mode] of [
      [questions, 'quiz'],
      [statements, 'true_false'],
      [pairs, 'quiz'],
    ] as const) {
      const game = gameOf(content, content === pairs ? 'all' : mode);
      const shown = liveQuestions(game, mode, 5, defaultGameModes) ?? [];
      shown.forEach((q, i) => {
        const right = q.options.filter((_, c) =>
          isCorrectLiveAnswer(game, mode, 5, i, c, defaultGameModes),
        );
        expect(right).toHaveLength(1);
      });
    }
  });

  it('true/false: the first choice means true', () => {
    const game = gameOf(statements, 'true_false');
    const shown = liveQuestions(game, 'true_false', 4, defaultGameModes) ?? [];
    shown.forEach((q, i) => {
      const truth = statementItems.find((s) => s.statement === q.prompt)?.isTrue;
      expect(rightChoices(game, 'true_false', 4)[i]).toBe(truth ? 0 : 1);
    });
  });

  it('a choice out of range, or a question that does not exist, is wrong', () => {
    const game = gameOf(questions, 'quiz');
    expect(isCorrectLiveAnswer(game, 'quiz', 1, 0, 9, defaultGameModes)).toBe(false);
    expect(isCorrectLiveAnswer(game, 'quiz', 1, 0, -1, defaultGameModes)).toBe(false);
    expect(isCorrectLiveAnswer(game, 'quiz', 1, 0, 0.5, defaultGameModes)).toBe(false);
    expect(isCorrectLiveAnswer(game, 'quiz', 1, 7, 0, defaultGameModes)).toBe(false);
    expect(isCorrectLiveAnswer(game, 'matching', 1, 0, 0, defaultGameModes)).toBe(false);
  });
});
