import { sql, type Kysely } from 'kysely';

/**
 * Job progress: a job that runs in steps (a long quiz written in parts) stores which items it is
 * working on, so its owner's progress page can say so. All three are set together or not at all.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('jobs')
    .addColumn('progress_from', 'integer')
    .addColumn('progress_to', 'integer')
    .addColumn('progress_total', 'integer')
    .execute();
  await db.schema
    .alterTable('jobs')
    .addCheckConstraint(
      'jobs_progress_check',
      sql`(progress_from IS NULL AND progress_to IS NULL AND progress_total IS NULL)
        OR (progress_from >= 1 AND progress_from <= progress_to AND progress_to <= progress_total)`,
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('jobs').dropConstraint('jobs_progress_check').execute();
  await db.schema
    .alterTable('jobs')
    .dropColumn('progress_total')
    .dropColumn('progress_to')
    .dropColumn('progress_from')
    .execute();
}
