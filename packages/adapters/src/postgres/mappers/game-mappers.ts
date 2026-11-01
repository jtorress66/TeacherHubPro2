import {
  allModes,
  contentKinds,
  defaultGameModes,
  gradeMethods,
  languages,
  type AssignmentId,
  type ClassId,
  type Game,
  type GameContent,
  type GameId,
  type GameModeChoice,
  type GameModeId,
  type GamePlay,
  type GamePlayId,
  type GradeCategoryId,
  type SchoolId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import type { GamePlaysTable, GamesTable } from '../schema.ts';
import { oneOf, readJson, toJson, type TimedRowMapper, type RowMapper } from './columns.ts';

const modeIds: readonly GameModeId[] = defaultGameModes.all().map((mode) => mode.id);
const modeChoices: readonly GameModeChoice[] = [allModes, ...modeIds];

/** Content was validated before saving; check its shape so a changed database fails loudly. */
function gameContent(value: unknown): GameContent {
  const content = readJson(value) as { kind?: unknown; items?: unknown } | null;
  oneOf(contentKinds, content?.kind, 'games.content');
  if (!Array.isArray(content?.items)) throw new Error('Unexpected value in games.content');
  return content as GameContent;
}

export const gameMapper: TimedRowMapper<Game, GamesTable> = {
  toRow: (game) => ({
    id: game.id,
    school_id: game.schoolId,
    teacher_id: game.teacherId,
    title: game.title,
    mode: game.mode,
    language: game.language,
    content: toJson(game.content),
    class_id: game.classId,
    count_as_grade: game.grading.countAsGrade,
    grade_method: game.grading.method,
    grade_points: game.grading.points,
    grade_category_id: game.grading.categoryId,
    grade_assignment_id: game.grading.assignmentId,
    created_at: game.createdAt,
    updated_at: game.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id as GameId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    title: row.title,
    mode: oneOf(modeChoices, row.mode, 'games.mode'),
    content: gameContent(row.content),
    language: oneOf(languages, row.language, 'games.language'),
    classId: row.class_id as ClassId | null,
    grading: {
      countAsGrade: row.count_as_grade,
      method: oneOf(gradeMethods, row.grade_method, 'games.grade_method'),
      points: row.grade_points,
      categoryId: row.grade_category_id as GradeCategoryId | null,
      assignmentId: row.grade_assignment_id as AssignmentId | null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
};

export const gamePlayMapper: RowMapper<GamePlay, GamePlaysTable> = {
  toRow: (play) => ({
    id: play.id,
    school_id: play.schoolId,
    game_id: play.gameId,
    class_id: play.classId,
    student_id: play.studentId,
    mode: play.mode,
    seed: play.seed,
    score: play.score,
    total: play.total,
    duration_ms: play.durationMs,
    played_at: play.playedAt,
  }),
  fromRow: (row) => ({
    id: row.id as GamePlayId,
    schoolId: row.school_id as SchoolId,
    gameId: row.game_id as GameId,
    classId: row.class_id as ClassId,
    studentId: row.student_id as StudentId,
    mode: oneOf(modeIds, row.mode, 'game_plays.mode'),
    seed: row.seed,
    score: row.score,
    total: row.total,
    durationMs: row.duration_ms,
    playedAt: row.played_at,
  }),
};
