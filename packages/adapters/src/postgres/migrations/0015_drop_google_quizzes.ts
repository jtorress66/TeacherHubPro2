import type { Kysely } from 'kysely';
import { up as createGoogleQuizzes } from './0014_google_quizzes.ts';

/**
 * Google Forms quizzes made from a PDF without a class were dropped at the teacher's request
 * (teachers post their own Word documents instead), so their table goes too.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('google_quizzes').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await createGoogleQuizzes(db);
}
