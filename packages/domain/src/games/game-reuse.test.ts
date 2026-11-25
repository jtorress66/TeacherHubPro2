import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  ClassId,
  GameId,
  GradeCategoryId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import { maxGameItems, type GameContent, type QuestionItem } from './content.ts';
import type { Game } from './game.ts';
import { appendGameItems, duplicateGame } from './game-reuse.ts';
import { seededRandom } from './random.ts';

const question = (prompt: string): QuestionItem => ({
  prompt,
  options: [`${prompt} yes`, `${prompt} no`],
  answer: 0,
});
const questions = (...prompts: string[]): GameContent => ({
  kind: 'questions',
  items: prompts.map(question),
});

const created = new Date('2026-11-01T12:00:00Z');
const game = (content: GameContent, overrides: Partial<Game> = {}): Game => ({
  id: 'game-1' as GameId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'teacher-1' as UserId,
  title: 'Planets',
  mode: 'quiz',
  content,
  language: 'es',
  classId: 'class-1' as ClassId,
  grading: {
    countAsGrade: true,
    method: 'first',
    points: 50,
    categoryId: 'cat-1' as GradeCategoryId,
    assignmentId: 'a-1' as AssignmentId,
  },
  createdAt: created,
  updatedAt: created,
  ...overrides,
});

describe('duplicateGame', () => {
  it('copies the content, mode and language, unshared and without grading', () => {
    const now = new Date('2026-11-25T10:00:00Z');
    const copy = duplicateGame(game(questions('A', 'B', 'C')), {
      id: 'game-2' as GameId,
      title: 'Planets (copy)',
      now,
    });

    expect(copy).toEqual({
      ...game(questions('A', 'B', 'C')),
      id: 'game-2',
      title: 'Planets (copy)',
      classId: null,
      grading: {
        countAsGrade: false,
        method: 'best',
        points: 100,
        categoryId: null,
        assignmentId: null,
      },
      createdAt: now,
      updatedAt: now,
    });
  });

  it('keeps a long copy title within the title limit', () => {
    const copy = duplicateGame(game(questions('A', 'B', 'C')), {
      id: 'game-2' as GameId,
      title: 'x'.repeat(250),
      now: created,
    });

    expect(copy.title).toHaveLength(200);
  });
});

describe('appendGameItems', () => {
  const random = seededRandom(7);

  it('adds the other game’s items at the end, skipping repeats', () => {
    const result = appendGameItems(questions('A', 'B', 'C'), questions('b', 'D'), random);

    expect(result).toEqual({
      ok: true,
      value: {
        content: questions('A', 'B', 'C', 'D'),
        added: 1,
        skipped: 1,
      },
    });
  });

  it('stops at the most items a game can have', () => {
    const many = Array.from({ length: maxGameItems - 1 }, (_, i) => `Q${String(i)}`);
    const result = appendGameItems(questions(...many), questions('X', 'Y', 'Z'), random);

    expect(result.ok && result.value.content.items).toHaveLength(maxGameItems);
    expect(result.ok && [result.value.added, result.value.skipped]).toEqual([1, 2]);
  });

  it('turns matching pairs into quiz questions', () => {
    const pairs: GameContent = {
      kind: 'pairs',
      items: [
        { term: 'Sun', definition: 'A star' },
        { term: 'Moon', definition: 'A satellite' },
        { term: 'Mars', definition: 'A planet' },
      ],
    };
    const result = appendGameItems(questions('A', 'B', 'C'), pairs, random);

    expect(result.ok && result.value.added).toBe(3);
    const added = result.ok ? result.value.content.items.slice(3) : [];
    expect(added.map((item) => (item as QuestionItem).prompt)).toEqual(['Sun', 'Moon', 'Mars']);
  });

  it('refuses items of a kind it cannot turn into this game’s kind', () => {
    const steps: GameContent = { kind: 'steps', items: ['One', 'Two', 'Three'] };

    expect(appendGameItems(questions('A', 'B', 'C'), steps, random)).toEqual({
      ok: false,
      error: { field: 'source', code: 'not_allowed' },
    });
  });

  it('refuses when nothing new would be added', () => {
    expect(appendGameItems(questions('A', 'B', 'C'), questions('a', 'B'), random)).toEqual({
      ok: false,
      error: { field: 'source', code: 'duplicate' },
    });
  });
});
