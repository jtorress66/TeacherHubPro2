import { createDatabase } from '@thp/adapters';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://teacherhub:teacherhub@localhost:5433/teacherhub';

/**
 * Test-only: turns any super admin back into a teacher, so the first super admin setup page can
 * run again on every local E2E run against the shared test database.
 */
export async function resetSuperAdmins(): Promise<void> {
  const db = createDatabase(databaseUrl);
  try {
    await db
      .updateTable('users')
      .set({ role: 'teacher' })
      .where('role', '=', 'super_admin')
      .execute();
  } finally {
    await db.destroy();
  }
}

/** Test-only: makes the account with this email its school's admin. */
export async function makeSchoolAdmin(email: string): Promise<void> {
  const db = createDatabase(databaseUrl);
  try {
    await db
      .updateTable('users')
      .set({ role: 'school_admin' })
      .where('email', '=', email.toLowerCase())
      .execute();
  } finally {
    await db.destroy();
  }
}

/** Test-only: makes the account with this email a super admin, without the one-time setup page. */
export async function makeSuperAdmin(email: string): Promise<void> {
  const db = createDatabase(databaseUrl);
  try {
    await db
      .updateTable('users')
      .set({ role: 'super_admin' })
      .where('email', '=', email.toLowerCase())
      .execute();
  } finally {
    await db.destroy();
  }
}

/** Test-only: moves the account with this email into the school of the account with the other. */
export async function joinSchoolOf(email: string, colleagueEmail: string): Promise<void> {
  const db = createDatabase(databaseUrl);
  try {
    const colleague = await db
      .selectFrom('users')
      .select('school_id')
      .where('email', '=', colleagueEmail.toLowerCase())
      .executeTakeFirstOrThrow();
    await db
      .updateTable('users')
      .set({ school_id: colleague.school_id })
      .where('email', '=', email.toLowerCase())
      .execute();
  } finally {
    await db.destroy();
  }
}
