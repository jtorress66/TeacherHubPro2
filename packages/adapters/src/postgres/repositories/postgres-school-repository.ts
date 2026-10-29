import type { Kysely } from 'kysely';
import type { School, SchoolId } from '@thp/domain';
import type { SchoolRepository } from '@thp/ports';
import { schoolMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

/** A school is its own scope. */
export class PostgresSchoolRepository implements SchoolRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: SchoolId): Promise<School | null> {
    const row = await this.db
      .selectFrom('schools')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : schoolMapper.fromRow(row);
  }

  save(school: School): Promise<void> {
    return upsert(this.db, 'schools', schoolMapper.toRow(school));
  }
}
