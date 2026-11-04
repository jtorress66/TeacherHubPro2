import { sql, type Kysely } from 'kysely';

/**
 * Family portals and email: families' read-only links (only the token's hash is kept), which
 * trial reminders went out, and the mail the local stand-in mailer "sent" (development only).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('portal_links')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('sent_to', 'text')
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex('portal_links_class_idx')
    .on('portal_links')
    .columns(['school_id', 'class_id', 'created_at'])
    .execute();

  await db.schema
    .createTable('trial_reminders')
    .addColumn('subscription_id', 'text', (c) =>
      c.notNull().references('subscriptions.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('sent_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('trial_reminders_pkey', ['subscription_id', 'kind'])
    .addCheckConstraint('trial_reminders_kind_check', sql`kind in ('three_days', 'last_day')`)
    .execute();

  await db.schema
    .createTable('sent_mail')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('to_address', 'text', (c) => c.notNull())
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('html', 'text', (c) => c.notNull())
    .addColumn('text_body', 'text', (c) => c.notNull())
    .addColumn('sent_at', 'timestamptz', (c) => c.notNull())
    .execute();
  await db.schema.createIndex('sent_mail_sent_at_idx').on('sent_mail').column('sent_at').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sent_mail').execute();
  await db.schema.dropTable('trial_reminders').execute();
  await db.schema.dropTable('portal_links').execute();
}
