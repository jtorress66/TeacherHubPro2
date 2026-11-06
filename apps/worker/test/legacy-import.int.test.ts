import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, inject, it } from 'vitest';
import {
  createDatabase,
  createPostgresRepositories,
  LegacyAwarePasswordHasher,
  NodeRandomTokenGenerator,
  ScryptPasswordHasher,
  Sha256TokenHasher,
  SystemClock,
} from '@thp/adapters';
import { LogIn } from '@thp/application';
import type { SchoolId, UserId } from '@thp/domain';
import { importLegacyData } from '../src/container.ts';

/** A small export written like `mongoexport` does, with fake people only. */
const folder = fileURLToPath(new URL('./fixtures/legacy-export', import.meta.url));
const config = { databaseUrl: inject('databaseUrl') };
const db = createDatabase(config.databaseUrl);
const repos = createPostgresRepositories(db);
afterAll(() => db.destroy());

const school = 'school_legacy1' as SchoolId;
const teacher = 'user_legacy1' as UserId;

const counts = async () => ({
  users: (await repos.users.listBySchool(school)).length,
  students: (await db.selectFrom('students').select('id').where('school_id', '=', school).execute())
    .length,
  grades: (await db.selectFrom('grades').select('id').where('school_id', '=', school).execute())
    .length,
});

describe('importing an old export into Postgres', () => {
  it('writes nothing on a dry run, then imports every record, and the same again on a second run', async () => {
    const dry = await importLegacyData(config, folder, false);
    expect(dry.unaccounted).toEqual([]);
    expect(await repos.users.findById(school, teacher)).toBeNull();

    const report = await importLegacyData(config, folder, true);
    expect(report.collections.map((c) => [c.collection, c.read, c.imported])).toEqual(
      expect.arrayContaining([
        ['schools', 1, 1],
        ['users', 1, 1],
        ['classes', 1, 1],
        ['students', 2, 2],
        ['grades', 2, 2],
        ['attendance_sessions', 1, 1],
        ['lesson_plans', 1, 1],
        ['portal_tokens', 1, 1],
        ['subscriptions', 1, 1],
        ['user_sessions', 1, 0],
      ]),
    );
    const first = await counts();
    expect(first).toEqual({ users: 1, students: 2, grades: 2 });

    await importLegacyData(config, folder, true);
    expect(await counts()).toEqual(first);
  });

  it('lets the migrated teacher log in with their old password, and upgrades its hash', async () => {
    await importLegacyData(config, folder, true);
    const logIn = new LogIn({
      ...repos,
      passwordHasher: new LegacyAwarePasswordHasher(new ScryptPasswordHasher()),
      tokens: new NodeRandomTokenGenerator(),
      tokenHasher: new Sha256TokenHasher(),
      clock: new SystemClock(),
    });

    const loggedIn = await logIn.execute({
      email: 'legacy.teacher@example.edu',
      password: 'my old password',
    });
    expect(loggedIn.ok).toBe(true);
    expect((await repos.credentials.findByUserId(teacher))?.passwordHash).toMatch(/^scrypt\$/u);
    expect(
      (await logIn.execute({ email: 'legacy.teacher@example.edu', password: 'wrong' })).ok,
    ).toBe(false);
  });

  it('keeps the old family link working through its hash', async () => {
    await importLegacyData(config, folder, true);
    const hash = await new Sha256TokenHasher().hash('portal_legacy0e2e0family0link');

    expect(await repos.portalLinks.findByTokenHash(hash)).toMatchObject({
      studentId: 'student_legacy1',
      classId: 'class_legacy1',
    });
  });
});
