import type { Kysely } from 'kysely';
import type { ClassId, Game, GameId, SchoolId, UserId } from '@thp/domain';
import type { GameRepository } from '@thp/ports';
import { gameMapper } from '../mappers/game-mappers.ts';
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

  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]> {
    return this.list(schoolId, 'teacher_id', teacherId);
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Game[]> {
    return this.list(schoolId, 'class_id', classId);
  }

  private async list(
    schoolId: SchoolId,
    column: 'teacher_id' | 'class_id',
    value: string,
  ): Promise<readonly Game[]> {
    const rows = await this.db
      .selectFrom('games')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where(column, '=', value)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(gameMapper.fromRow);
  }
}
