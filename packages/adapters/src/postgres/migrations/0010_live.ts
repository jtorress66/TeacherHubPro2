import { sql, type Kysely, type RawBuilder } from 'kysely';

const inList = (column: string, values: readonly string[]): RawBuilder<boolean> =>
  sql<boolean>`${sql.ref(column)} in (${sql.join(values.map((value) => sql.lit(value)))})`;

/** Written out, so this migration means the same thing however the code changes later. */
const kinds = ['live', 'self_paced'];
const statuses = ['lobby', 'question', 'reveal', 'open', 'ended'];

/**
 * Play to Learn: live and self-paced sessions of a game for a class, the roster students who
 * joined by tapping their name, and their server-timed answers.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('live_sessions')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('teacher_id', 'text', (c) => c.notNull().references('users.id'))
    .addColumn('game_id', 'text', (c) => c.notNull().references('games.id').onDelete('cascade'))
    .addColumn('class_id', 'text', (c) => c.notNull().references('classes.id').onDelete('cascade'))
    .addColumn('kind', 'text', (c) => c.notNull())
    .addColumn('mode', 'text', (c) => c.notNull())
    .addColumn('pin', 'text', (c) => c.notNull())
    .addColumn('seed', 'integer', (c) => c.notNull())
    .addColumn('question_count', 'integer', (c) => c.notNull())
    .addColumn('question_seconds', 'integer', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('current', 'integer', (c) => c.notNull())
    .addColumn('question_started_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull())
    .addColumn('ended_at', 'timestamptz')
    .addCheckConstraint('live_sessions_kind_check', inList('kind', kinds))
    .addCheckConstraint('live_sessions_status_check', inList('status', statuses))
    .addCheckConstraint('live_sessions_pin_check', sql`pin ~ '^[0-9]{6}$'`)
    .addCheckConstraint('live_sessions_seconds_check', sql`question_seconds between 5 and 120`)
    .addCheckConstraint('live_sessions_count_check', sql`question_count > 0`)
    .execute();
  await sql`create unique index live_sessions_open_pin_key on live_sessions (pin) where status <> 'ended'`.execute(
    db,
  );
  await db.schema
    .createIndex('live_sessions_teacher_idx')
    .on('live_sessions')
    .columns(['school_id', 'teacher_id', 'created_at'])
    .execute();
  await db.schema
    .createIndex('live_sessions_game_idx')
    .on('live_sessions')
    .columns(['school_id', 'game_id'])
    .execute();

  await db.schema
    .createTable('live_players')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('session_id', 'text', (c) =>
      c.notNull().references('live_sessions.id').onDelete('cascade'),
    )
    .addColumn('student_id', 'text', (c) =>
      c.notNull().references('students.id').onDelete('cascade'),
    )
    .addColumn('first_name', 'text', (c) => c.notNull())
    .addColumn('token_hash', 'text', (c) => c.notNull())
    .addColumn('joined_at', 'timestamptz', (c) => c.notNull())
    .addColumn('removed_at', 'timestamptz')
    .execute();
  await sql`create unique index live_players_active_student_key on live_players (session_id, student_id) where removed_at is null`.execute(
    db,
  );

  await db.schema
    .createTable('live_answers')
    .addColumn('school_id', 'text', (c) => c.notNull().references('schools.id'))
    .addColumn('session_id', 'text', (c) =>
      c.notNull().references('live_sessions.id').onDelete('cascade'),
    )
    .addColumn('player_id', 'text', (c) =>
      c.notNull().references('live_players.id').onDelete('cascade'),
    )
    .addColumn('question', 'integer', (c) => c.notNull())
    .addColumn('prompt', 'text', (c) => c.notNull())
    .addColumn('choice', 'integer', (c) => c.notNull())
    .addColumn('correct', 'boolean', (c) => c.notNull())
    .addColumn('ms', 'integer', (c) => c.notNull())
    .addColumn('points', 'integer', (c) => c.notNull())
    .addPrimaryKeyConstraint('live_answers_pkey', ['player_id', 'question'])
    .addCheckConstraint('live_answers_points_check', sql`points >= 0 and ms >= 0`)
    .execute();
  await db.schema
    .createIndex('live_answers_session_idx')
    .on('live_answers')
    .columns(['school_id', 'session_id'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('live_answers').execute();
  await db.schema.dropTable('live_players').execute();
  await db.schema.dropTable('live_sessions').execute();
}
