import type { Kysely } from 'kysely';

/** The prep agent's weekly batches: AI drafts waiting for the teacher to approve and publish. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('prep_batches')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('request', 'jsonb', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('items', 'jsonb', (c) => c.notNull())
    .addColumn('parent_email', 'jsonb')
    .addColumn('job_id', 'text', (c) => c.notNull())
    .addColumn('started_at', 'timestamptz', (c) => c.notNull())
    .addColumn('ready_at', 'timestamptz')
    .addColumn('published_at', 'timestamptz')
    .addColumn('published', 'jsonb')
    .execute();
  await db.schema
    .createIndex('prep_batches_teacher_idx')
    .on('prep_batches')
    .columns(['school_id', 'teacher_id', 'started_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('prep_batches').execute();
}
