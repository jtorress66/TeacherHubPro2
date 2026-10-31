import { sql, type Kysely } from 'kysely';

/**
 * Assignments students answer from personal links: general instructions, attachments, per-question
 * scores on submissions (one per student and assignment), student links and Classroom connections.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('assignments').addColumn('instructions', 'text').execute();

  await db.schema
    .alterTable('submissions')
    .addColumn('late', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('question_scores', 'jsonb', (c) => c.notNull().defaultTo(sql`'{}'::jsonb`))
    .execute();
  await db.schema
    .createIndex('submissions_assignment_id_student_id_key')
    .on('submissions')
    .columns(['assignment_id', 'student_id'])
    .unique()
    .execute();

  await db.schema
    .createTable('assignment_attachments')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('assignment_id', 'text', (c) =>
      c.notNull().references('assignments.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('content_type', 'text', (c) => c.notNull())
    .addColumn('size', 'integer', (c) => c.notNull())
    .addColumn('key', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('assignment_attachments_size_check', sql`size > 0`)
    .execute();
  await db.schema
    .createIndex('assignment_attachments_assignment_id_idx')
    .on('assignment_attachments')
    .column('assignment_id')
    .execute();

  await db.schema
    .createTable('student_links')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex('student_links_class_id_idx')
    .on('student_links')
    .columns(['school_id', 'class_id'])
    .execute();

  await db.schema
    .createTable('classroom_connections')
    .addColumn('teacher_id', 'text', (c) =>
      c.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('encrypted_refresh_token', 'text', (c) => c.notNull())
    .addColumn('connected_at', 'timestamptz', (c) => c.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('classroom_connections').execute();
  await db.schema.dropTable('student_links').execute();
  await db.schema.dropTable('assignment_attachments').execute();
  await db.schema.dropIndex('submissions_assignment_id_student_id_key').execute();
  await db.schema
    .alterTable('submissions')
    .dropColumn('late')
    .dropColumn('question_scores')
    .execute();
  await db.schema.alterTable('assignments').dropColumn('instructions').execute();
}
