import type { Kysely } from 'kysely';
import type { GameId, GamePlay, GamePlayId, SchoolId } from '@thp/domain';
import type { GamePlayRepository } from '@thp/ports';
import { gamePlayMapper } from '../mappers/game-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresGamePlayRepository implements GamePlayRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: GamePlayId): Promise<GamePlay | null> {
    const row = await this.db
      .selectFrom('game_plays')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : gamePlayMapper.fromRow(row);
  }

  save(play: GamePlay): Promise<void> {
    return upsert(this.db, 'game_plays', gamePlayMapper.toRow(play));
  }

  async listByGame(schoolId: SchoolId, gameId: GameId): Promise<readonly GamePlay[]> {
    const rows = await this.db
      .selectFrom('game_plays')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('game_id', '=', gameId)
      .orderBy('played_at')
      .orderBy('id')
      .execute();
    return rows.map(gamePlayMapper.fromRow);
  }

  async deleteByGame(schoolId: SchoolId, gameId: GameId): Promise<void> {
    await this.db
      .deleteFrom('game_plays')
      .where('school_id', '=', schoolId)
      .where('game_id', '=', gameId)
      .execute();
  }
}
