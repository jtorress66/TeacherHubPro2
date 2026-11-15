import { sql, type Kysely } from 'kysely';

/**
 * LTI grades: where teachers placed each assignment and game (so its students can open it from the
 * course, and its grades can go to that course), and each course's gradebook address with the
 * gradebook scopes its course system granted. Removing a course system or a teacher forgets their
 * placements; the assignments and games themselves stay.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('lti_placements')
    .addColumn('platform_id', 'text', (c) =>
      c.notNull().references('lti_platforms.id').onDelete('cascade'),
    )
    .addColumn('context_id', 'text', (c) => c.notNull())
    .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind IN ('assignment', 'game')`))
    .addColumn('item_id', 'text', (c) => c.notNull())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('placed_at', 'timestamptz', (c) => c.notNull())
    .addPrimaryKeyConstraint('lti_placements_pkey', [
      'platform_id',
      'context_id',
      'kind',
      'item_id',
    ])
    .execute();
  await db.schema
    .createIndex('lti_placements_school_id_kind_item_id_idx')
    .on('lti_placements')
    .columns(['school_id', 'kind', 'item_id'])
    .execute();

  await db.schema
    .alterTable('lti_courses')
    .addColumn('lineitems_url', 'text')
    .addColumn('grade_scopes', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('lti_courses')
    .dropColumn('grade_scopes')
    .dropColumn('lineitems_url')
    .execute();
  await db.schema.dropTable('lti_placements').execute();
}
