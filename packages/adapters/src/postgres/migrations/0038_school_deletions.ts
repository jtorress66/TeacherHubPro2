import type { Kysely } from 'kysely';

/**
 * Deleting a school's data: the request waiting out its hold (it goes with the school), and the
 * proof of each deletion, made of IDs and dates only, which outlives the school on purpose.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('school_deletion_requests')
    .addColumn('school_id', 'text', (c) =>
      c.primaryKey().references('schools.id').onDelete('cascade'),
    )
    .addColumn('requested_by', 'text', (c) => c.notNull())
    .addColumn('requested_at', 'timestamptz', (c) => c.notNull())
    .addColumn('delete_after', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('school_deletion_requests_due')
    .on('school_deletion_requests')
    .column('delete_after')
    .execute();

  await db.schema
    .createTable('school_deletions')
    .addColumn('school_id', 'text', (c) => c.primaryKey())
    .addColumn('requested_by', 'text', (c) => c.notNull())
    .addColumn('requested_at', 'timestamptz', (c) => c.notNull())
    .addColumn('deleted_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('school_deletions').execute();
  await db.schema.dropTable('school_deletion_requests').execute();
}
