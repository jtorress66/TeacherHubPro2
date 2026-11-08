import type { Kysely } from 'kysely';

/** Hardening for beta: try counters for rate limits, and each school's activity log. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('rate_limits')
    .addColumn('key', 'text', (c) => c.notNull())
    .addColumn('window_start', 'timestamptz', (c) => c.notNull())
    .addColumn('count', 'integer', (c) => c.notNull())
    .addPrimaryKeyConstraint('rate_limits_pkey', ['key', 'window_start'])
    .execute();

  await db.schema
    .createTable('audit_events')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id').onDelete('cascade'))
    .addColumn('actor_id', 'text', (c) => c.notNull())
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('target_id', 'text')
    .addColumn('at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('audit_events_school_idx')
    .on('audit_events')
    .columns(['school_id', 'at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('audit_events').execute();
  await db.schema.dropTable('rate_limits').execute();
}
