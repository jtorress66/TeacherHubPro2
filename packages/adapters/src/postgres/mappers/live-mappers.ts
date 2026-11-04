import {
  defaultGameModes,
  liveKinds,
  type ClassId,
  type GameId,
  type GameModeId,
  type LiveAnswer,
  type LivePlayer,
  type LivePlayerId,
  type LiveSession,
  type LiveSessionId,
  type LiveStatus,
  type SchoolId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import type { LiveAnswersTable, LivePlayersTable, LiveSessionsTable } from '../schema.ts';
import { oneOf, type RowMapper, type TimedRowMapper } from './columns.ts';

const modeIds: readonly GameModeId[] = defaultGameModes.all().map((mode) => mode.id);
const statuses: readonly LiveStatus[] = ['lobby', 'question', 'reveal', 'open', 'ended'];

export const liveSessionMapper: TimedRowMapper<LiveSession, LiveSessionsTable> = {
  toRow: (session) => ({
    id: session.id,
    school_id: session.schoolId,
    teacher_id: session.teacherId,
    game_id: session.gameId,
    class_id: session.classId,
    kind: session.kind,
    mode: session.mode,
    pin: session.pin,
    seed: session.seed,
    question_count: session.questionCount,
    question_seconds: session.questionSeconds,
    status: session.status,
    current: session.current,
    question_started_at: session.questionStartedAt,
    created_at: session.createdAt,
    ended_at: session.endedAt,
  }),
  fromRow: (row) => ({
    id: row.id as LiveSessionId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    gameId: row.game_id as GameId,
    classId: row.class_id as ClassId,
    kind: oneOf(liveKinds, row.kind, 'live_sessions.kind'),
    mode: oneOf(modeIds, row.mode, 'live_sessions.mode'),
    pin: row.pin,
    seed: row.seed,
    questionCount: row.question_count,
    questionSeconds: row.question_seconds,
    status: oneOf(statuses, row.status, 'live_sessions.status'),
    current: row.current,
    questionStartedAt: row.question_started_at,
    createdAt: row.created_at,
    endedAt: row.ended_at,
  }),
};

export const livePlayerMapper: RowMapper<LivePlayer, LivePlayersTable> = {
  toRow: (player) => ({
    id: player.id,
    school_id: player.schoolId,
    session_id: player.sessionId,
    student_id: player.studentId,
    first_name: player.firstName,
    token_hash: player.tokenHash,
    joined_at: player.joinedAt,
    removed_at: player.removedAt,
  }),
  fromRow: (row) => ({
    id: row.id as LivePlayerId,
    schoolId: row.school_id as SchoolId,
    sessionId: row.session_id as LiveSessionId,
    studentId: row.student_id as StudentId,
    firstName: row.first_name,
    tokenHash: row.token_hash,
    joinedAt: row.joined_at,
    removedAt: row.removed_at,
  }),
};

export const liveAnswerMapper = {
  toRow: (answer: LiveAnswer): LiveAnswersTable => ({
    school_id: answer.schoolId,
    session_id: answer.sessionId,
    player_id: answer.playerId,
    question: answer.question,
    prompt: answer.prompt,
    choice: answer.choice,
    correct: answer.correct,
    ms: answer.ms,
    points: answer.points,
  }),
  fromRow: (row: LiveAnswersTable): LiveAnswer => ({
    schoolId: row.school_id as SchoolId,
    sessionId: row.session_id as LiveSessionId,
    playerId: row.player_id as LivePlayerId,
    question: row.question,
    prompt: row.prompt,
    choice: row.choice,
    correct: row.correct,
    ms: row.ms,
    points: row.points,
  }),
};
