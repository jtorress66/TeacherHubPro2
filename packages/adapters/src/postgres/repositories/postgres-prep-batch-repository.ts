import type { Kysely } from 'kysely';
import type { PrepBatch, PrepBatchId, SchoolId, UserId } from '@thp/domain';
import type { PrepBatchRepository } from '@thp/ports';
import { prepBatchMapper } from '../mappers/prep-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresPrepBatchRepository implements PrepBatchRepository {
  constructor(private readonly db: Kysely<Database>) {}

  save(batch: PrepBatch): Promise<void> {
    return upsert(this.db, 'prep_batches', prepBatchMapper.toRow(batch));
  }

  async find(schoolId: SchoolId, teacherId: UserId, id: PrepBatchId): Promise<PrepBatch | null> {
    const row = await this.db
      .selectFrom('prep_batches')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : prepBatchMapper.fromRow(row);
  }

  async listForTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    limit: number,
  ): Promise<readonly PrepBatch[]> {
    const rows = await this.db
      .selectFrom('prep_batches')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('started_at', 'desc')
      .orderBy('id')
      .limit(limit)
      .execute();
    return rows.map(prepBatchMapper.fromRow);
  }

  async countReady(schoolId: SchoolId, teacherId: UserId): Promise<number> {
    const row = await this.db
      .selectFrom('prep_batches')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .where('status', '=', 'ready')
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async delete(schoolId: SchoolId, teacherId: UserId, id: PrepBatchId): Promise<boolean> {
    const result = await this.db
      .deleteFrom('prep_batches')
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}
