import type { Kysely } from 'kysely';
import type { Game, GameId, SchoolId, UserId } from '@thp/domain';
import type { GameRepository } from '@thp/ports';
import { gameMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresGameRepository implements GameRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: GameId): Promise<Game | null> {
    const row = await this.db
      .selectFrom('games')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : gameMapper.fromRow(row);
  }

  save(game: Game): Promise<void> {
    return upsert(this.db, 'games', gameMapper.toRow(game));
  }

  async delete(schoolId: SchoolId, id: GameId): Promise<void> {
    await this.db
      .deleteFrom('games')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]> {
    const rows = await this.db
      .selectFrom('games')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(gameMapper.fromRow);
  }
}
