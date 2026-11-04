import type { Kysely } from 'kysely';
import type {
  GameId,
  LiveAnswer,
  LivePlayer,
  LivePlayerId,
  LiveSession,
  LiveSessionId,
  SchoolId,
  UserId,
} from '@thp/domain';
import type { LiveAnswerRepository, LivePlayerRepository, LiveSessionRepository } from '@thp/ports';
import { liveAnswerMapper, livePlayerMapper, liveSessionMapper } from '../mappers/live-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresLiveSessionRepository implements LiveSessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: LiveSessionId): Promise<LiveSession | null> {
    const row = await this.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : liveSessionMapper.fromRow(row);
  }

  save(session: LiveSession): Promise<void> {
    return upsert(this.db, 'live_sessions', liveSessionMapper.toRow(session));
  }

  async delete(schoolId: SchoolId, id: LiveSessionId): Promise<void> {
    await this.db
      .deleteFrom('live_sessions')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async findOpenByPin(pin: string): Promise<LiveSession | null> {
    const row = await this.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('pin', '=', pin)
      .where('status', '<>', 'ended')
      .executeTakeFirst();
    return row === undefined ? null : liveSessionMapper.fromRow(row);
  }

  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LiveSession[]> {
    return this.list(schoolId, 'teacher_id', teacherId);
  }

  listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly LiveSession[]> {
    return this.list(schoolId, 'game_id', gameId);
  }

  private async list(
    schoolId: SchoolId,
    column: 'teacher_id' | 'game_id',
    value: string,
  ): Promise<readonly LiveSession[]> {
    const rows = await this.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where(column, '=', value)
      .orderBy('created_at', 'desc')
      .orderBy('id')
      .execute();
    return rows.map(liveSessionMapper.fromRow);
  }
}

export class PostgresLivePlayerRepository implements LivePlayerRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: LivePlayerId): Promise<LivePlayer | null> {
    const row = await this.db
      .selectFrom('live_players')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : livePlayerMapper.fromRow(row);
  }

  save(player: LivePlayer): Promise<void> {
    return upsert(this.db, 'live_players', livePlayerMapper.toRow(player));
  }

  async listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LivePlayer[]> {
    if (sessionIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('live_players')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('session_id', 'in', sessionIds)
      .orderBy('joined_at')
      .orderBy('id')
      .execute();
    return rows.map(livePlayerMapper.fromRow);
  }

  async deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void> {
    await this.db
      .deleteFrom('live_players')
      .where('school_id', '=', schoolId)
      .where('session_id', '=', sessionId)
      .execute();
  }
}

export class PostgresLiveAnswerRepository implements LiveAnswerRepository {
  constructor(private readonly db: Kysely<Database>) {}

  /** A plain insert: a second answer to the same question breaks the primary key and fails. */
  async save(answer: LiveAnswer): Promise<void> {
    await this.db.insertInto('live_answers').values(liveAnswerMapper.toRow(answer)).execute();
  }

  async listBySessions(
    schoolId: SchoolId,
    sessionIds: readonly LiveSessionId[],
  ): Promise<readonly LiveAnswer[]> {
    if (sessionIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('live_answers')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('session_id', 'in', sessionIds)
      .orderBy('question')
      .orderBy('player_id')
      .execute();
    return rows.map(liveAnswerMapper.fromRow);
  }

  async deleteBySession(schoolId: SchoolId, sessionId: LiveSessionId): Promise<void> {
    await this.db
      .deleteFrom('live_answers')
      .where('school_id', '=', schoolId)
      .where('session_id', '=', sessionId)
      .execute();
  }
}
