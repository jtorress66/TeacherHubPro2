import { describe, expect, it } from 'vitest';
import type { ClassId, GameId, GamePlayId, SchoolId, StudentId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  createGamePlay,
  gameSummary,
  gradeFromPlays,
  leaderboard,
  percentOf,
  studentStats,
  type GamePlay,
  type GamePlayInput,
} from './game-play.ts';

const ana = 'student-ana' as StudentId;
const ben = 'student-ben' as StudentId;
const cy = 'student-cy' as StudentId;

const input: GamePlayInput = {
  id: 'play-1' as GamePlayId,
  schoolId: 'school-1' as SchoolId,
  gameId: 'game-1' as GameId,
  classId: 'class-1' as ClassId,
  studentId: ana,
  mode: 'quiz',
  seed: 42,
  score: 3,
  total: 4,
  durationMs: 61_000,
  playedAt: new Date('2026-11-01T10:00:00Z'),
};

let nextId = 0;
const play = (
  studentId: StudentId,
  score: number,
  total: number,
  minute: number,
  durationMs = 60_000,
): GamePlay =>
  valueOf(
    createGamePlay({
      ...input,
      id: `play-${String((nextId += 1))}` as GamePlayId,
      studentId,
      score,
      total,
      durationMs,
      playedAt: new Date(Date.UTC(2026, 10, 1, 10, minute)),
    }),
  );

describe('createGamePlay', () => {
  it('records a scored play tied to a roster student, with the time taken', () => {
    expect(valueOf(createGamePlay(input))).toEqual(input);
  });

  it('needs a roster student and a sensible score and time', () => {
    expect(errorOf(createGamePlay({ ...input, studentId: '' as StudentId }))).toEqual({
      field: 'studentId',
      code: 'required',
    });
    for (const change of [{ total: 0 }, { score: 5 }, { score: -1 }, { score: 1.5 }]) {
      expect(errorOf(createGamePlay({ ...input, ...change }))).toEqual({
        field: 'score',
        code: 'out_of_range',
      });
    }
    expect(errorOf(createGamePlay({ ...input, durationMs: -1 }))).toEqual({
      field: 'durationMs',
      code: 'out_of_range',
    });
  });
});

describe('percentOf', () => {
  it('is the rounded percentage of the play', () => {
    expect(percentOf({ score: 2, total: 3 })).toBe(67);
  });
});

describe('gradeFromPlays', () => {
  const plays = [play(ana, 2, 4, 1), play(ana, 4, 4, 2), play(ana, 3, 4, 3)];

  it('takes the best, the first or the average attempt, as points', () => {
    expect(gradeFromPlays(plays, 'best', 20)).toBe(20);
    expect(gradeFromPlays(plays, 'first', 20)).toBe(10);
    expect(gradeFromPlays(plays, 'average', 20)).toBe(15);
  });

  it('uses play order, not list order, for the first attempt', () => {
    expect(gradeFromPlays([...plays].reverse(), 'first', 20)).toBe(10);
  });

  it('rounds to two decimals', () => {
    expect(gradeFromPlays([play(ana, 1, 3, 1)], 'best', 10)).toBe(3.33);
  });

  it('is null when the student has not played', () => {
    expect(gradeFromPlays([], 'best', 20)).toBeNull();
  });
});

describe('leaderboard', () => {
  const names = new Map([
    [ana, 'Ana'],
    [ben, 'Ben'],
  ]);

  it('ranks each student by their best play, faster first on a tie', () => {
    const plays = [
      play(ana, 2, 4, 1),
      play(ben, 4, 4, 2, 90_000),
      play(ana, 4, 4, 3, 30_000),
      play(ben, 1, 4, 4),
    ];
    expect(leaderboard(plays, names)).toEqual([
      {
        rank: 1,
        studentId: ana,
        name: 'Ana',
        percent: 100,
        durationMs: 30_000,
        playedAt: plays[2]?.playedAt,
      },
      {
        rank: 2,
        studentId: ben,
        name: 'Ben',
        percent: 100,
        durationMs: 90_000,
        playedAt: plays[1]?.playedAt,
      },
    ]);
  });

  it('leaves out students without a name (no longer on the roster) and keeps the top ten', () => {
    expect(leaderboard([play(cy, 4, 4, 1)], names)).toEqual([]);

    const many = new Map(
      Array.from({ length: 12 }, (_, i) => [`s${String(i)}` as StudentId, `S${String(i)}`]),
    );
    const plays = [...many.keys()].map((id, i) => play(id, i, 12, i));
    const board = leaderboard(plays, many);
    expect(board).toHaveLength(10);
    expect(board[0]?.name).toBe('S11');
  });
});

describe('studentStats and gameSummary', () => {
  const plays = [play(ana, 2, 4, 1), play(ben, 3, 4, 2), play(ana, 4, 4, 3)];

  it('gives each student’s attempts, best, last and last time played', () => {
    expect(studentStats(plays)).toEqual([
      {
        studentId: ana,
        attempts: 2,
        bestPercent: 100,
        lastPercent: 100,
        lastPlayedAt: plays[2]?.playedAt,
      },
      {
        studentId: ben,
        attempts: 1,
        bestPercent: 75,
        lastPercent: 75,
        lastPlayedAt: plays[1]?.playedAt,
      },
    ]);
  });

  it('summarises plays, students and the average score', () => {
    expect(gameSummary(plays)).toEqual({ plays: 3, students: 2, averagePercent: 75 });
    expect(gameSummary([])).toEqual({ plays: 0, students: 0, averagePercent: null });
  });
});
