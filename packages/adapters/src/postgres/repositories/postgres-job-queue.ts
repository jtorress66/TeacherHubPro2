import { sql, type Kysely } from 'kysely';
import type { Job, JobId, SchoolId, UserId } from '@thp/domain';
import type { IdGenerator, JobQueue, NewJob } from '@thp/ports';
import { toJson } from '../mappers/columns.ts';
import { jobFromRow } from '../mappers/job-mapper.ts';
import type { Database } from '../schema.ts';

/**
 * Jobs stored in Postgres, so any web or worker process sees the same queue. Workers claim with
 * `FOR UPDATE SKIP LOCKED`, so two workers never take the same job.
 */
export class PostgresJobQueue implements JobQueue {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly ids: IdGenerator,
  ) {}

  async enqueue(job: NewJob): Promise<Job> {
    const row = await this.db
      .insertInto('jobs')
      .values({
        id: this.ids.next(),
        school_id: job.schoolId,
        owner_id: job.ownerId,
        kind: job.kind,
        payload: toJson(job.payload),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return jobFromRow(row);
  }

  async claimNext(kinds: readonly string[]): Promise<Job | null> {
    if (kinds.length === 0) return null;
    const next = this.db
      .selectFrom('jobs')
      .select('id')
      .where('status', '=', 'queued')
      .where('kind', 'in', kinds)
      .orderBy('created_at')
      .orderBy('id')
      .limit(1)
      .forUpdate()
      .skipLocked();
    const row = await this.db
      .updateTable('jobs')
      .set({
        status: 'running',
        attempts: sql<number>`attempts + 1`,
        started_at: sql<Date>`clock_timestamp()`,
      })
      .where('id', '=', next)
      .returningAll()
      .executeTakeFirst();
    return row === undefined ? null : jobFromRow(row);
  }

  async complete(id: JobId, result: unknown): Promise<void> {
    await this.db
      .updateTable('jobs')
      .set({
        status: 'completed',
        result: toJson(result),
        finished_at: sql<Date>`clock_timestamp()`,
      })
      .where('id', '=', id)
      .execute();
  }

  async fail(id: JobId, error: string): Promise<void> {
    await this.db
      .updateTable('jobs')
      .set({ status: 'failed', error, finished_at: sql<Date>`clock_timestamp()` })
      .where('id', '=', id)
      .execute();
  }

  async failStale(createdBefore: Date, error: string): Promise<number> {
    const result = await this.db
      .updateTable('jobs')
      .set({ status: 'failed', error, finished_at: sql<Date>`clock_timestamp()` })
      .where('status', 'in', ['queued', 'running'])
      .where('created_at', '<', createdBefore)
      .executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  async findForOwner(schoolId: SchoolId, ownerId: UserId, id: JobId): Promise<Job | null> {
    const row = await this.db
      .selectFrom('jobs')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('owner_id', '=', ownerId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : jobFromRow(row);
  }
}
