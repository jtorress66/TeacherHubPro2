import type { Kysely } from 'kysely';

/**
 * The approval log: when a teacher approves AI work, the activity line also says which class,
 * whether an AI grade was kept as suggested, and how many grades or family emails it covered.
 * Earlier lines leave these empty. Only IDs and counts are stored, never content.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('audit_events')
    .addColumn('review', 'text')
    .addColumn('count', 'integer')
    .addColumn('class_id', 'text')
    .execute();
  await db.schema
    .createIndex('audit_events_school_action_idx')
    .on('audit_events')
    .columns(['school_id', 'action', 'at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('audit_events_school_action_idx').execute();
  await db.schema
    .alterTable('audit_events')
    .dropColumn('class_id')
    .dropColumn('count')
    .dropColumn('review')
    .execute();
}
