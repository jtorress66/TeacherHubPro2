import type { Kysely, Selectable } from 'kysely';
import type { CalendarFeed, SchoolId, UserId } from '@thp/domain';
import type { CalendarFeedRepository } from '@thp/ports';
import type { CalendarFeedsTable, Database } from '../schema.ts';

const fromRow = (row: Selectable<CalendarFeedsTable>): CalendarFeed => ({
  teacherId: row.teacher_id as UserId,
  schoolId: row.school_id as SchoolId,
  tokenHash: row.token_hash,
  createdAt: row.created_at,
});

export class PostgresCalendarFeedRepository implements CalendarFeedRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByTokenHash(tokenHash: string): Promise<CalendarFeed | null> {
    const row = await this.db
      .selectFrom('calendar_feeds')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row === undefined ? null : fromRow(row);
  }

  async find(schoolId: SchoolId, teacherId: UserId): Promise<CalendarFeed | null> {
    const row = await this.db
      .selectFrom('calendar_feeds')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .executeTakeFirst();
    return row === undefined ? null : fromRow(row);
  }

  async save(feed: CalendarFeed): Promise<void> {
    const row = {
      teacher_id: feed.teacherId,
      school_id: feed.schoolId,
      token_hash: feed.tokenHash,
      created_at: feed.createdAt,
    };
    await this.db
      .insertInto('calendar_feeds')
      .values(row)
      .onConflict((conflict) => conflict.column('teacher_id').doUpdateSet(row))
      .execute();
  }

  async delete(schoolId: SchoolId, teacherId: UserId): Promise<void> {
    await this.db
      .deleteFrom('calendar_feeds')
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .execute();
  }
}
