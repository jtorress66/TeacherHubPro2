import type { ClassId, GameId, GamePlayId, SchoolId, StudentId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import type { GradeMethod } from './game.ts';
import type { GameModeId } from './mode-registry.ts';

/** One finished play by a roster student (teacher previews are never saved). */
export interface GamePlay {
  readonly id: GamePlayId;
  readonly schoolId: SchoolId;
  readonly gameId: GameId;
  readonly classId: ClassId;
  readonly studentId: StudentId;
  readonly mode: GameModeId;
  /** Rebuilds the exact round that was played. */
  readonly seed: number;
  readonly score: number;
  readonly total: number;
  readonly durationMs: number;
  readonly playedAt: Date;
}

export type GamePlayInput = GamePlay;

export function createGamePlay(input: GamePlayInput): Result<GamePlay, ValidationError> {
  if (input.studentId.trim() === '') return invalid('studentId', 'required');
  const wholeScore = Number.isInteger(input.score) && Number.isInteger(input.total);
  if (!wholeScore || input.total < 1 || input.score < 0 || input.score > input.total) {
    return invalid('score', 'out_of_range');
  }
  if (!Number.isInteger(input.durationMs) || input.durationMs < 0) {
    return invalid('durationMs', 'out_of_range');
  }
  return ok(input);
}

const fraction = (play: Pick<GamePlay, 'score' | 'total'>): number => play.score / play.total;

export const percentOf = (play: Pick<GamePlay, 'score' | 'total'>): number =>
  Math.round(fraction(play) * 100);

const byTime = (a: GamePlay, b: GamePlay): number => a.playedAt.getTime() - b.playedAt.getTime();

const roundTo2 = (value: number): number => Math.round(value * 100) / 100;

const fractionBy: Readonly<Record<GradeMethod, (plays: readonly GamePlay[]) => number>> = {
  best: (plays) => Math.max(...plays.map(fraction)),
  first: (plays) =>
    fraction(plays.reduce((first, play) => (byTime(play, first) < 0 ? play : first))),
  average: (plays) => plays.reduce((sum, play) => sum + fraction(play), 0) / plays.length,
};

/** A student's grade, in points, from their plays; null when they have not played. */
export function gradeFromPlays(
  plays: readonly GamePlay[],
  method: GradeMethod,
  points: number,
): number | null {
  if (plays.length === 0) return null;
  return roundTo2(fractionBy[method](plays) * points);
}

const byStudent = (plays: readonly GamePlay[]): Map<StudentId, GamePlay[]> => {
  const grouped = new Map<StudentId, GamePlay[]>();
  for (const play of [...plays].sort(byTime)) {
    grouped.set(play.studentId, [...(grouped.get(play.studentId) ?? []), play]);
  }
  return new Map([...grouped].sort(([a], [b]) => a.localeCompare(b)));
};

/** Higher score first, then faster, then earlier. */
const better = (a: GamePlay, b: GamePlay): number =>
  fraction(b) - fraction(a) || a.durationMs - b.durationMs || byTime(a, b);

export interface LeaderboardEntry {
  readonly rank: number;
  readonly studentId: StudentId;
  readonly name: string;
  readonly percent: number;
  readonly durationMs: number;
  readonly playedAt: Date;
}

export const leaderboardSize = 10;

/**
 * Each student's best play, ranked. The caller passes the names the viewer may see (first
 * names for students, full names for teachers); students without a name are left out.
 */
export function leaderboard(
  plays: readonly GamePlay[],
  names: ReadonlyMap<StudentId, string>,
): LeaderboardEntry[] {
  const best = [...byStudent(plays).values()]
    .map((own) => own.reduce((best, play) => (better(play, best) < 0 ? play : best)))
    .filter((play) => names.has(play.studentId))
    .sort(better)
    .slice(0, leaderboardSize);
  return best.map((play, index) => ({
    rank: index + 1,
    studentId: play.studentId,
    name: names.get(play.studentId) ?? '',
    percent: percentOf(play),
    durationMs: play.durationMs,
    playedAt: play.playedAt,
  }));
}

export interface StudentGameStats {
  readonly studentId: StudentId;
  readonly attempts: number;
  readonly bestPercent: number;
  readonly lastPercent: number;
  readonly lastPlayedAt: Date;
}

export function studentStats(plays: readonly GamePlay[]): StudentGameStats[] {
  return [...byStudent(plays)].map(([studentId, own]) => {
    const last = own.reduce((latest, play) => (byTime(play, latest) > 0 ? play : latest));
    return {
      studentId,
      attempts: own.length,
      bestPercent: Math.max(...own.map(percentOf)),
      lastPercent: percentOf(last),
      lastPlayedAt: last.playedAt,
    };
  });
}

export interface GameSummary {
  readonly plays: number;
  readonly students: number;
  readonly averagePercent: number | null;
}

export function gameSummary(plays: readonly GamePlay[]): GameSummary {
  if (plays.length === 0) return { plays: 0, students: 0, averagePercent: null };
  const average = plays.reduce((sum, play) => sum + fraction(play), 0) / plays.length;
  return {
    plays: plays.length,
    students: new Set(plays.map((play) => play.studentId)).size,
    averagePercent: Math.round(average * 100),
  };
}
