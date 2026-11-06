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
