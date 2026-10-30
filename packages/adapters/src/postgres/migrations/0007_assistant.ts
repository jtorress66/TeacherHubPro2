import { sql, type Kysely } from 'kysely';
import {
  assistantSubjects,
  contentTypes,
  gradeLevels,
  languages,
  presentationThemes,
} from '@thp/domain';

const inList = (column: string, values: readonly string[]) =>
  sql`${sql.ref(column)} IN (${sql.join(values.map((value) => sql.lit(value)))})`;

/** The AI assistant's history, presentations, and substitute notes per class. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ai_generations')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('grade', 'text', (c) => c.notNull())
    .addColumn('topic', 'text', (c) => c.notNull())
    .addColumn('language', 'text', (c) => c.notNull())
    .addColumn('content', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('ai_generations_type_check', inList('type', contentTypes))
    .addCheckConstraint('ai_generations_subject_check', inList('subject', assistantSubjects))
    .addCheckConstraint('ai_generations_grade_check', inList('grade', gradeLevels))
    .addCheckConstraint('ai_generations_language_check', inList('language', languages))
    .execute();
  await db.schema
    .createIndex('ai_generations_school_id_teacher_id_created_at_idx')
    .on('ai_generations')
    .columns(['school_id', 'teacher_id', 'created_at'])
    .execute();

  await db.schema
    .createTable('presentations')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('topic', 'text')
    .addColumn('subject', 'text')
    .addColumn('grade', 'text')
    .addColumn('theme', 'text', (c) => c.notNull())
    .addColumn('slides', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('presentations_theme_check', inList('theme', presentationThemes))
    .execute();
  await db.schema
    .createIndex('presentations_school_id_teacher_id_updated_at_idx')
    .on('presentations')
    .columns(['school_id', 'teacher_id', 'updated_at'])
    .execute();

  await db.schema
    .createTable('sub_packets')
    .addColumn('class_id', 'text', (c) =>
      c.primaryKey().references('classes.id').onDelete('cascade'),
    )
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('main_office_ext', 'text')
    .addColumn('nurse_ext', 'text')
    .addColumn('daily_routines', 'text')
    .addColumn('emergency_procedures', 'text')
    .addColumn('additional_notes', 'text')
    .addColumn('include_accommodations', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('sub_packets').execute();
  await db.schema.dropTable('presentations').execute();
  await db.schema.dropTable('ai_generations').execute();
}
