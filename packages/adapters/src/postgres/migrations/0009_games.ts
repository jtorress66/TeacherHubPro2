import { sql, type Kysely, type RawBuilder } from 'kysely';

const inList = (column: string, values: readonly string[]): RawBuilder<boolean> =>
  sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`;

/** Written out, so this migration means the same thing however the code changes later. */
const gradeSourcesBefore = ['manual', 'confirmed_ai'];
const gradeSourcesAfter = ['manual', 'confirmed_ai', 'game'];
const gradeMethods = ['best', 'first', 'average'];

/**
 * Educational games: typed content played in one mode or all, shared with a class, optionally
 * counted as a (teacher-confirmed) grade; plays by roster students; `game` as a grade source.
 * Games had no screen before this step, so no saved game exists; any test row is removed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`delete from games`.execute(db);
  await db.schema.alterTable('games').dropColumn('items').execute();
  await db.schema.alterTable('games').renameColumn('mode_id', 'mode').execute();
  await db.schema
    .alterTable('games')
    .addColumn('content', 'jsonb', (c) => c.notNull())
    .addColumn('class_id', 'text', (c) => c.references('classes.id').onDelete('set null'))
    .addColumn('count_as_grade', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('grade_method', 'text', (c) => c.notNull().defaultTo('best'))
    .addColumn('grade_points', 'integer', (c) => c.notNull().defaultTo(100))
    .addColumn('grade_category_id', 'text', (c) =>
      c.references('grade_categories.id').onDelete('set null'),
    )
    .addColumn('grade_assignment_id', 'text', (c) =>
      c.references('assignments.id').onDelete('set null'),
    )
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .alterTable('games')
    .addCheckConstraint('games_grade_method_check', inList('grade_method', gradeMethods))
    .execute();
  await db.schema
    .alterTable('games')
    .addCheckConstraint('games_grade_points_check', sql`grade_points between 1 and 1000`)
    .execute();
  await db.schema
    .createIndex('games_class_id_idx')
    .on('games')
    .columns(['school_id', 'class_id'])
    .execute();

  await db.schema
    .createTable('game_plays')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('game_id', 'text', (c) => c.notNull().references('games.id').onDelete('cascade'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('mode', 'text', (c) => c.notNull())
    .addColumn('seed', 'integer', (c) => c.notNull())
    .addColumn('score', 'integer', (c) => c.notNull())
    .addColumn('total', 'integer', (c) => c.notNull())
    .addColumn('duration_ms', 'integer', (c) => c.notNull())
    .addColumn('played_at', 'timestamptz', (c) => c.notNull())
    .addCheckConstraint('game_plays_score_check', sql`total > 0 and score between 0 and total`)
    .addCheckConstraint('game_plays_duration_check', sql`duration_ms >= 0`)
    .execute();
  await db.schema
    .createIndex('game_plays_game_id_idx')
    .on('game_plays')
    .columns(['school_id', 'game_id', 'played_at'])
    .execute();

  await db.schema.alterTable('grades').dropConstraint('grades_source_check').execute();
  await db.schema
    .alterTable('grades')
    .addCheckConstraint('grades_source_check', inList('source', gradeSourcesAfter))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`delete from grades where source = 'game'`.execute(db);
  await db.schema.alterTable('grades').dropConstraint('grades_source_check').execute();
  await db.schema
    .alterTable('grades')
    .addCheckConstraint('grades_source_check', inList('source', gradeSourcesBefore))
    .execute();
  await db.schema.dropTable('game_plays').execute();
  await db.schema.dropIndex('games_class_id_idx').execute();
  await sql`delete from games`.execute(db);
  await db.schema.alterTable('games').dropConstraint('games_grade_points_check').execute();
  await db.schema.alterTable('games').dropConstraint('games_grade_method_check').execute();
  await db.schema
    .alterTable('games')
    .dropColumn('content')
    .dropColumn('class_id')
    .dropColumn('count_as_grade')
    .dropColumn('grade_method')
    .dropColumn('grade_points')
    .dropColumn('grade_category_id')
    .dropColumn('grade_assignment_id')
    .dropColumn('updated_at')
    .execute();
  await db.schema.alterTable('games').renameColumn('mode', 'mode_id').execute();
  await db.schema
    .alterTable('games')
    .addColumn('items', 'jsonb', (c) => c.notNull())
    .execute();
}
