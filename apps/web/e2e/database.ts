import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const legacyExport = fileURLToPath(
  new URL('../../worker/test/fixtures/legacy-export', import.meta.url),
);

/**
 * Test-only: imports a small synthetic export of the old app (fake people) through the real
 * command, from a folder outside the repository as a real export must be.
 */
export function importLegacyExport(): void {
  const folder = mkdtempSync(join(tmpdir(), 'thp-legacy-'));
  try {
    cpSync(legacyExport, folder, { recursive: true });
    execSync(`pnpm migrate:legacy --from "${folder}" --apply`, {
      cwd: fileURLToPath(new URL('../../..', import.meta.url)),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
