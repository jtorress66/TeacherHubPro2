import { sql, type Kysely } from 'kysely';

/**
 * Report card comments, stored files (school logos), the school's logo key in place of an
 * unused logo URL, and grades that go with their assignment when it is deleted.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('report_card_comments')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id'))
    .addColumn('student_id', 'text', (c) => c.notNull().references('students.id'))
    .addColumn('text', 'text', (c) => c.notNull())
    .addColumn('written_by', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('report_card_comments_class_student_key', ['class_id', 'student_id'])
    .addCheckConstraint(
      'report_card_comments_text_check',
      sql`char_length(text) BETWEEN 1 AND 1000`,
    )
    .execute();
  await db.schema
    .createIndex('report_card_comments_school_id_class_id_idx')
    .on('report_card_comments')
    .columns(['school_id', 'class_id'])
    .execute();

  await db.schema
    .createTable('stored_files')
    .addColumn('key', 'text', (c) => c.primaryKey())
    .addColumn('content_type', 'text', (c) => c.notNull())
    .addColumn('bytes', 'bytea', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.alterTable('schools').renameColumn('logo_url', 'logo_key').execute();

  await db.schema.alterTable('grades').dropConstraint('grades_assignment_id_fkey').execute();
  await db.schema
    .alterTable('grades')
    .addForeignKeyConstraint('grades_assignment_id_fkey', ['assignment_id'], 'assignments', ['id'])
    .onDelete('cascade')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('grades').dropConstraint('grades_assignment_id_fkey').execute();
  await db.schema
    .alterTable('grades')
    .addForeignKeyConstraint('grades_assignment_id_fkey', ['assignment_id'], 'assignments', ['id'])
    .execute();
  await db.schema.alterTable('schools').renameColumn('logo_key', 'logo_url').execute();
  await db.schema.dropTable('stored_files').execute();
  await db.schema.dropTable('report_card_comments').execute();
}
