import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  ClassId,
  GameId,
  GradeCategoryId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import type { GameContent } from './content.ts';
import {
  attachGradeAssignment,
  createGame,
  playableModes,
  setGrading,
  updateGame,
  type GameInput,
} from './game.ts';
import { defaultGameModes } from './mode-registry.ts';

const pairs: GameContent = {
  kind: 'pairs',
  items: [
    { term: 'Sun', definition: 'Our star' },
    { term: 'Moon', definition: 'Earth’s satellite' },
    { term: 'Comet', definition: 'Icy body with a tail' },
    { term: 'Orbit', definition: 'Path around a body' },
    { term: 'Planet', definition: 'Travels around a star' },
  ],
};

const steps: GameContent = { kind: 'steps', items: ['Mix', 'Pour', 'Bake'] };
const createdAt = new Date('2026-11-01T10:00:00Z');

const base: GameInput = {
  id: 'game-1' as GameId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
  title: ' Solar system ',
  mode: 'matching',
  content: pairs,
  createdAt,
};

const game = () => valueOf(createGame(base, defaultGameModes));

describe('createGame', () => {
  it('creates a game in English by default, with no class and grading off', () => {
    expect(game()).toEqual({
      id: base.id,
      schoolId: base.schoolId,
      teacherId: base.teacherId,
      title: 'Solar system',
      mode: 'matching',
      content: pairs,
      language: 'en',
      classId: null,
      grading: {
        countAsGrade: false,
        method: 'best',
        points: 100,
        categoryId: null,
        assignmentId: null,
      },
      createdAt,
      updatedAt: createdAt,
    });
    const spanish = valueOf(createGame({ ...base, language: 'es' }, defaultGameModes));
    expect(spanish.language).toBe('es');
  });

  it('needs a real title, not just "Quiz" or "Game"', () => {
    expect(errorOf(createGame({ ...base, title: ' ' }, defaultGameModes))).toEqual({
      field: 'title',
      code: 'required',
    });
    for (const title of ['Quiz', 'game', 'Juego', 'Untitled']) {
      expect(errorOf(createGame({ ...base, title }, defaultGameModes))).toEqual({
        field: 'title',
        code: 'not_allowed',
      });
    }
  });

  it('checks the content', () => {
    const tooFew: GameContent = { kind: 'pairs', items: pairs.items.slice(0, 2) };
    expect(errorOf(createGame({ ...base, content: tooFew }, defaultGameModes))).toEqual({
      field: 'items',
      code: 'too_short',
    });
  });

  it('the mode must exist and play the content', () => {
    expect(errorOf(createGame({ ...base, mode: 'chess' }, defaultGameModes))).toEqual({
      field: 'mode',
      code: 'invalid_format',
    });
    expect(errorOf(createGame({ ...base, mode: 'sequence' }, defaultGameModes))).toEqual({
      field: 'mode',
      code: 'not_allowed',
    });
  });

  it('applies the mode’s own rules (a word search term must fit the grid)', () => {
    const long: GameContent = {
      kind: 'pairs',
      items: [...pairs.items, { term: 'Photosynthesis process', definition: 'How plants eat' }],
    };
    expect(
      errorOf(createGame({ ...base, content: long, mode: 'word_search' }, defaultGameModes)),
    ).toEqual({
      field: 'items.5.term',
      code: 'out_of_range',
    });
  });

  it('"all modes" needs term and definition pairs', () => {
    expect(valueOf(createGame({ ...base, mode: 'all' }, defaultGameModes)).mode).toBe('all');
    expect(errorOf(createGame({ ...base, mode: 'all', content: steps }, defaultGameModes))).toEqual(
      { field: 'mode', code: 'not_allowed' },
    );
  });

  it('rejects an unsupported language', () => {
    expect(errorOf(createGame({ ...base, language: 'xx' }, defaultGameModes))).toEqual({
      field: 'language',
      code: 'invalid_format',
    });
  });
});

describe('playableModes', () => {
  it('is the game’s one mode, or every pairs mode that suits it for "all modes"', () => {
    expect(playableModes(game(), defaultGameModes).map((m) => m.id)).toEqual(['matching']);

    const all = valueOf(createGame({ ...base, mode: 'all' }, defaultGameModes));
    expect(playableModes(all, defaultGameModes).map((m) => m.id)).toEqual([
      'quiz',
      'time_attack',
      'flashcards',
      'matching',
      'memory',
      'word_search',
      'crossword',
    ]);
  });

  it('leaves out modes whose own rules the content breaks', () => {
    const long: GameContent = {
      kind: 'pairs',
      items: [...pairs.items, { term: 'Photosynthesis process', definition: 'How plants eat' }],
    };
    const all = valueOf(createGame({ ...base, mode: 'all', content: long }, defaultGameModes));
    expect(playableModes(all, defaultGameModes).map((m) => m.id)).not.toContain('word_search');
  });
});

describe('updateGame', () => {
  const later = new Date('2026-11-02T10:00:00Z');

  it('changes title, mode, content, language and class, keeping the rest', () => {
    const updated = valueOf(
      updateGame(
        game(),
        {
          title: 'Order of baking',
          mode: 'sequence',
          content: steps,
          classId: 'class-1' as ClassId,
        },
        later,
        defaultGameModes,
      ),
    );
    expect(updated).toMatchObject({
      id: base.id,
      title: 'Order of baking',
      mode: 'sequence',
      content: steps,
      classId: 'class-1',
      createdAt,
      updatedAt: later,
    });
  });

  it('checks the change like a new game', () => {
    expect(errorOf(updateGame(game(), { mode: 'sequence' }, later, defaultGameModes))).toEqual({
      field: 'mode',
      code: 'not_allowed',
    });
  });

  it('a class change turns grading off, since the grade belonged to the old class', () => {
    const graded = valueOf(
      setGrading(
        { ...game(), classId: 'class-1' as ClassId },
        { countAsGrade: true, method: 'best', points: 10, categoryId: 'cat-1' as GradeCategoryId },
      ),
    );
    const moved = valueOf(
      updateGame(graded, { classId: 'class-2' as ClassId }, later, defaultGameModes),
    );
    expect(moved.grading).toMatchObject({ countAsGrade: false, assignmentId: null });

    const same = valueOf(updateGame(graded, { title: 'Space words' }, later, defaultGameModes));
    expect(same.grading.countAsGrade).toBe(true);
  });
});

describe('grading settings', () => {
  const inClass = () => ({ ...game(), classId: 'class-1' as ClassId });
  const on = {
    countAsGrade: true,
    method: 'average',
    points: 20,
    categoryId: 'cat-1' as GradeCategoryId,
  };

  it('counts the game as a grade by a method and points', () => {
    expect(valueOf(setGrading(inClass(), on)).grading).toEqual({
      countAsGrade: true,
      method: 'average',
      points: 20,
      categoryId: 'cat-1',
      assignmentId: null,
    });
  });

  it('needs a class and a category to count as a grade', () => {
    expect(errorOf(setGrading(game(), on))).toEqual({ field: 'classId', code: 'required' });
    expect(errorOf(setGrading(inClass(), { ...on, categoryId: null }))).toEqual({
      field: 'categoryId',
      code: 'required',
    });
  });

  it('checks the method and points', () => {
    expect(errorOf(setGrading(inClass(), { ...on, method: 'last' }))).toEqual({
      field: 'method',
      code: 'invalid_format',
    });
    for (const points of [0, 1001, 2.5]) {
      expect(errorOf(setGrading(inClass(), { ...on, points }))).toEqual({
        field: 'points',
        code: 'out_of_range',
      });
    }
  });

  it('keeps its gradebook assignment when turned off and on again', () => {
    const attached = attachGradeAssignment(
      valueOf(setGrading(inClass(), on)),
      'a-9' as AssignmentId,
    );
    const off = valueOf(setGrading(attached, { ...on, countAsGrade: false }));
    expect(off.grading).toMatchObject({ countAsGrade: false, assignmentId: 'a-9' });
    expect(valueOf(setGrading(off, on)).grading.assignmentId).toBe('a-9');
  });
});
