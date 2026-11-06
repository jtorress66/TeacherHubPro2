import type { Kysely } from 'kysely';

/** The marketing site: leads, and the website chatbot's chats and their turns. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('leads')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('email', 'text', (c) => c.notNull())
    .addColumn('organization', 'text')
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('interest', 'text', (c) => c.notNull())
    .addColumn('source', 'text', (c) => c.notNull())
    .addColumn('message', 'text')
    .addColumn('locale', 'text', (c) => c.notNull())
    .addColumn('page', 'text')
    .addColumn('score', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('received_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('leads_received_idx').on('leads').column('received_at').execute();

  await db.schema
    .createTable('chat_sessions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('visitor_hash', 'text', (c) => c.notNull())
    .addColumn('role', 'text', (c) => c.notNull())
    .addColumn('interest', 'text', (c) => c.notNull())
    .addColumn('locale', 'text', (c) => c.notNull())
    .addColumn('page', 'text')
    .addColumn('turns', 'integer', (c) => c.notNull())
    .addColumn('started_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('chat_sessions_visitor_idx')
    .on('chat_sessions')
    .column('visitor_hash')
    .execute();

  await db.schema
    .createTable('chat_turns')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('session_id', 'text', (c) =>
      c.notNull().references('chat_sessions.id').onDelete('cascade'),
    )
    .addColumn('message', 'text', (c) => c.notNull())
    .addColumn('reply', 'text')
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('claimed', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('sent_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema
    .createIndex('chat_turns_session_idx')
    .on('chat_turns')
    .columns(['session_id', 'sent_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('chat_turns').execute();
  await db.schema.dropTable('chat_sessions').execute();
  await db.schema.dropTable('leads').execute();
}
