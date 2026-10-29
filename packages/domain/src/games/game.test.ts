import { describe, expect, it } from 'vitest';
import { type GameId, type GameModeId, type SchoolId, type UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createGame } from './game.ts';

const base = {
  id: 'game-1' as GameId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
  title: 'Planets',
  modeId: 'quiz' as GameModeId,
  items: [{ q: 'Largest planet?', a: 'Jupiter' }],
};

describe('createGame', () => {
  it('creates a game in the teacher’s language, English by default', () => {
    expect(valueOf(createGame(base))).toEqual({ ...base, language: 'en' });
    expect(valueOf(createGame({ ...base, language: 'es' })).language).toBe('es');
  });

  it('needs a title and at least one item', () => {
    expect(errorOf(createGame({ ...base, title: '' }))).toEqual({
      field: 'title',
      code: 'required',
    });
    expect(errorOf(createGame({ ...base, items: [] }))).toEqual({
      field: 'items',
      code: 'required',
    });
  });

  it('rejects an unsupported language', () => {
    expect(errorOf(createGame({ ...base, language: 'xx' }))).toEqual({
      field: 'language',
      code: 'invalid_format',
    });
  });
});
