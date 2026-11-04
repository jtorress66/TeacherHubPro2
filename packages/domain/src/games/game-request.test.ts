import { describe, expect, it } from 'vitest';
import { errorOf, valueOf } from '../test-support.ts';
import { createGameRequest, gameCountRange, type GameRequestInput } from './game-request.ts';

const input: GameRequestInput = {
  kind: 'pairs',
  subject: 'science',
  grade: '4',
  topic: ' The solar system ',
  language: 'es',
};

describe('createGameRequest', () => {
  it('asks for the default number of items, trimmed, with nothing to avoid', () => {
    expect(valueOf(createGameRequest(input))).toEqual({
      kind: 'pairs',
      subject: 'science',
      grade: '4',
      topic: 'The solar system',
      count: 8,
      language: 'es',
      avoid: [],
      standard: null,
      difficulty: 'medium',
    });
  });

  it('can aim at an official Common Core standard and a difficulty', () => {
    const aimed = valueOf(
      createGameRequest({
        ...input,
        subject: 'math',
        standard: ' CCSS.Math.Content.4.NF.A.1 ',
        difficulty: 'hard',
      }),
    );
    expect(aimed).toMatchObject({ standard: 'CCSS.Math.Content.4.NF.A.1', difficulty: 'hard' });
    expect(valueOf(createGameRequest({ ...input, standard: '' })).standard).toBeNull();
    expect(errorOf(createGameRequest({ ...input, standard: 'CCSS.Made.Up.1' }))).toEqual({
      field: 'standard',
      code: 'invalid_format',
    });
    expect(errorOf(createGameRequest({ ...input, difficulty: 'extreme' }))).toEqual({
      field: 'difficulty',
      code: 'invalid_format',
    });
  });

  it('keeps the count within the kind’s range', () => {
    expect(gameCountRange('groups')).toEqual({ min: 2, max: 4, default: 3 });
    expect(gameCountRange('pairs')).toEqual({ min: 4, max: 15, default: 8 });
    expect(gameCountRange('steps')).toEqual({ min: 3, max: 12, default: 8 });
    expect(valueOf(createGameRequest({ ...input, count: 12 })).count).toBe(12);
    for (const count of [3, 16, 6.5]) {
      expect(errorOf(createGameRequest({ ...input, count }))).toEqual({
        field: 'count',
        code: 'out_of_range',
      });
    }
  });

  it('lists the items to avoid when asking again, up to 30', () => {
    const avoid = Array.from({ length: 40 }, (_, i) => `Item ${String(i)}`);
    const request = valueOf(createGameRequest({ ...input, avoid: [' Sun ', '', ...avoid] }));
    expect(request.avoid).toHaveLength(30);
    expect(request.avoid[0]).toBe('Sun');
  });

  it('rejects an unknown kind, subject, grade or language, and a blank topic', () => {
    const cases: [Partial<GameRequestInput>, string, string][] = [
      [{ kind: 'riddles' }, 'kind', 'invalid_format'],
      [{ subject: 'alchemy' }, 'subject', 'invalid_format'],
      [{ grade: '13' }, 'grade', 'invalid_format'],
      [{ language: 'xx' }, 'language', 'invalid_format'],
      [{ topic: ' ' }, 'topic', 'required'],
    ];
    for (const [change, field, code] of cases) {
      expect(errorOf(createGameRequest({ ...input, ...change }))).toEqual({ field, code });
    }
  });
});
