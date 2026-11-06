import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import {
  InMemoryPasswordTokenRepository,
  InMemoryPlatformStats,
  InMemorySchoolDirectory,
  InMemoryUserDirectory,
} from '@thp/testing';
import {
  ChangeUserRole,
  CreateClass,
  CreateSchool,
  CreateUser,
  DeleteSchool,
  DeleteUser,
  GetPlatformOverview,
  ImportSchoolStudents,
  ImportTeachers,
  ListAllUsers,
  ListSchoolClasses,
  ListSchools,
  ListSchoolUsers,
  LogIn,
  RequestPasswordReset,
  SendPasswordLink,
  SetPassword,
  SetUpFirstSuperAdmin,
  TransferClasses,
  UpdateSchool,
  UpdateUser,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

/** The world with the admin ports, and a setup key. */
function adminWorld(setupKey: string | null = 'right-key') {
  const world = makeWorld();
  const stores = {
    schools: world.schools,
    users: world.users,
    classes: world.classes,
    students: world.students,
    lessonPlans: world.lessonPlans,
    presentations: world.presentations,
    generations: world.generations,
    grades: world.grades,
    subscriptions: world.subscriptions,
  };
  return {
    ...world,
    schoolDirectory: new InMemorySchoolDirectory(stores),
    userDirectory: new InMemoryUserDirectory(stores),
    platformStats: new InMemoryPlatformStats(stores),
    passwordTokens: new InMemoryPasswordTokenRepository(),
    setupKey,
  };
}
type AdminWorld = ReturnType<typeof adminWorld>;

const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };

/** The link's secret, from the last email sent to an address. */
function linkTokenFor(world: World, email: string): string {
  const mail = [...world.mailer.outbox].reverse().find((m) => m.to === email);
  const token = /#([^\s"]+)/u.exec(mail?.text ?? '')?.[1];
  if (token === undefined) throw new Error(`no link for ${email}`);
  return token;
}

async function superAdmin(world: AdminWorld) {
  const { user } = await signedUp(world, 'root@platform.edu');
  valueOf(await new SetUpFirstSuperAdmin(world).execute({ email: user.email, key: 'right-key' }));
  return { ...user, role: 'super_admin' as const };
}

async function schoolWithStaff(world: AdminWorld) {
  const root = await superAdmin(world);
  const school = valueOf(
    await new CreateSchool(world).execute({ actor: root, details: { name: 'Lincoln Middle' } }),
  );
  const add = async (name: string, email: string, role: 'teacher' | 'school_admin') =>
    valueOf(
      await new CreateUser(world).execute({
        actor: root,
        schoolId: school.id,
        details: { name, email, role, language: 'en' },
      }),
    );
  const principal = await add('Pat Principal', 'pat@lincoln.edu', 'school_admin');
  const teacher = await add('Tina Teacher', 'tina@lincoln.edu', 'teacher');
  const other = await add('Omar Other', 'omar@lincoln.edu', 'teacher');
  return { root, school, principal, teacher, other };
}

describe('SetUpFirstSuperAdmin', () => {
  it('promotes an existing account once, only with the right key', async () => {
    const world = adminWorld();
    const { user } = await signedUp(world, 'root@platform.edu');
    expect(
      await new SetUpFirstSuperAdmin(world).execute({ email: user.email, key: 'wrong' }),
    ).toEqual({ ok: false, error: { code: 'forbidden' } });
    expect(
      await new SetUpFirstSuperAdmin(world).execute({ email: 'nobody@x.edu', key: 'right-key' }),
    ).toEqual(notFound);
    valueOf(await new SetUpFirstSuperAdmin(world).execute({ email: user.email, key: 'right-key' }));
    expect((await world.users.findById(user.schoolId, user.id))?.role).toBe('super_admin');

    const { user: second } = await signedUp(world, 'second@platform.edu');
    expect(
      await new SetUpFirstSuperAdmin(world).execute({ email: second.email, key: 'right-key' }),
    ).toEqual({ ok: false, error: { code: 'already_set_up' } });
  });

  it('is off when no key is configured', async () => {
    const world = adminWorld(null);
    const { user } = await signedUp(world);
    expect(await new SetUpFirstSuperAdmin(world).execute({ email: user.email, key: '' })).toEqual({
      ok: false,
      error: { code: 'setup_unavailable' },
    });
  });
});

describe('Super admin: schools and users', () => {
  it('creates a school whose first account starts its trial, and welcomes each user by email', async () => {
    const world = adminWorld();
    const { school, principal, teacher } = await schoolWithStaff(world);
    const subscriptions = await world.subscriptions.listBySchool(school.id);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ ownerId: principal.id, status: 'trialing' });
    expect(world.mailer.outbox.map((m) => m.to)).toEqual(
      expect.arrayContaining(['pat@lincoln.edu', 'tina@lincoln.edu']),
    );
    expect(world.mailer.outbox.at(-2)?.text).toMatch(
      /^welcome: https:\/\/app\.teacherhub\.test\/en\/set-password#/u,
    );
    expect(teacher).toMatchObject({ role: 'teacher', schoolId: school.id });
  });

  it('refuses a taken email, an unknown school, and anyone but a super admin', async () => {
    const world = adminWorld();
    const { root, school, principal } = await schoolWithStaff(world);
    const details = {
      name: 'Dup',
      email: 'tina@lincoln.edu',
      role: 'teacher' as const,
      language: 'en',
    };
    expect(
      await new CreateUser(world).execute({ actor: root, schoolId: school.id, details }),
    ).toEqual({ ok: false, error: { code: 'email_taken' } });
    expect(
      await new CreateUser(world).execute({
        actor: root,
        schoolId: 'nope' as SchoolId,
        details: { ...details, email: 'new@x.edu' },
      }),
    ).toEqual(notFound);
    for (const run of [
      () => new ListSchools(world).execute({ actor: principal }),
      () => new GetPlatformOverview(world).execute({ actor: principal }),
      () => new ListAllUsers(world).execute({ actor: principal }),
      () => new CreateSchool(world).execute({ actor: principal, details: { name: 'Mine' } }),
    ]) {
      expect(await run()).toEqual(forbidden);
    }
  });

  it('lists schools with counts, the overview, users across schools, and a school’s classes', async () => {
    const world = adminWorld();
    const { root, school, teacher } = await schoolWithStaff(world);
    valueOf(
      await new CreateClass(world).execute({ actor: teacher, details: { name: 'Science 7' } }),
    );
    const schools = valueOf(await new ListSchools(world).execute({ actor: root }));
    expect(schools.find((s) => s.school.id === school.id)?.counts).toEqual({
      schoolId: school.id,
      users: 3,
      classes: 1,
      students: 0,
    });
    const overview = valueOf(await new GetPlatformOverview(world).execute({ actor: root }));
    expect(overview.counts.users).toMatchObject({ super_admin: 1, school_admin: 1, teacher: 2 });
    expect(overview.recentUsers.length).toBeGreaterThan(0);
    const found = valueOf(await new ListAllUsers(world).execute({ actor: root, text: 'tina' }));
    expect(found.map((row) => [row.user.email, row.schoolName])).toEqual([
      ['tina@lincoln.edu', 'Lincoln Middle'],
    ]);
    const classes = valueOf(
      await new ListSchoolClasses(world).execute({ actor: root, schoolId: school.id }),
    );
    expect(classes.map((c) => c.name)).toEqual(['Science 7']);
  });

  it('edits and deletes a school only while no one belongs to it', async () => {
    const world = adminWorld();
    const { root, school } = await schoolWithStaff(world);
    const renamed = valueOf(
      await new UpdateSchool(world).execute({
        actor: root,
        schoolId: school.id,
        details: { name: 'Lincoln MS', phone: '555-0101' },
      }),
    );
    expect(renamed).toMatchObject({ name: 'Lincoln MS', phone: '555-0101' });
    expect(await new DeleteSchool(world).execute({ actor: root, schoolId: school.id })).toEqual({
      ok: false,
      error: { code: 'in_use' },
    });
    const empty = valueOf(
      await new CreateSchool(world).execute({ actor: root, details: { name: 'Empty' } }),
    );
    valueOf(await new DeleteSchool(world).execute({ actor: root, schoolId: empty.id }));
    expect(await world.schools.findById(empty.id)).toBeNull();
  });

  it('edits a user, moves them only without classes, and deletes only others without classes', async () => {
    const world = adminWorld();
    const { root, school, teacher, other } = await schoolWithStaff(world);
    const elsewhere = valueOf(
      await new CreateSchool(world).execute({ actor: root, details: { name: 'Elsewhere' } }),
    );
    const update = (userId: UserId, changes: { name?: string; schoolId?: SchoolId }) =>
      new UpdateUser(world).execute({
        actor: root,
        schoolId: school.id,
        userId,
        details: {
          name: changes.name ?? 'Tina T.',
          email: 'tina@lincoln.edu',
          role: 'teacher',
          schoolId: changes.schoolId ?? school.id,
        },
      });
    expect(valueOf(await update(teacher.id, {})).name).toBe('Tina T.');
    valueOf(await new CreateClass(world).execute({ actor: teacher, details: { name: 'Bio' } }));
    expect(await update(teacher.id, { schoolId: elsewhere.id })).toEqual({
      ok: false,
      error: { code: 'has_classes' },
    });
    expect(
      await new DeleteUser(world).execute({ actor: root, schoolId: school.id, userId: teacher.id }),
    ).toEqual({ ok: false, error: { code: 'has_classes' } });
    expect(
      await new DeleteUser(world).execute({
        actor: root,
        schoolId: root.schoolId,
        userId: root.id,
      }),
    ).toEqual({ ok: false, error: { code: 'own_account' } });
    valueOf(
      await new DeleteUser(world).execute({ actor: root, schoolId: school.id, userId: other.id }),
    );
    expect(await world.users.findById(school.id, other.id)).toBeNull();
  });
});

describe('School admin', () => {
  it('lists only their school’s users and changes roles they may give', async () => {
    const world = adminWorld();
    const { principal, teacher, school } = await schoolWithStaff(world);
    const rows = valueOf(await new ListSchoolUsers(world).execute({ actor: principal }));
    expect(rows.map((r) => r.user.email).sort()).toEqual([
      'omar@lincoln.edu',
      'pat@lincoln.edu',
      'tina@lincoln.edu',
    ]);
    const promoted = valueOf(
      await new ChangeUserRole(world).execute({
        actor: principal,
        userId: teacher.id,
        role: 'school_admin',
      }),
    );
    expect(promoted.role).toBe('school_admin');
    expect(
      await new ChangeUserRole(world).execute({
        actor: principal,
        userId: teacher.id,
        role: 'super_admin',
      }),
    ).toEqual(forbidden);
    expect(
      await new ChangeUserRole(world).execute({
        actor: principal,
        userId: principal.id,
        role: 'teacher',
      }),
    ).toEqual({ ok: false, error: { code: 'own_account' } });
    expect(school.id).toBe(principal.schoolId);
  });

  it('never sees or changes another school’s users, and a teacher is not an admin', async () => {
    const world = adminWorld();
    const { principal, teacher } = await schoolWithStaff(world);
    const { user: outsider } = await signedUp(world, 'outsider@else.edu');
    expect(
      await new ChangeUserRole(world).execute({
        actor: principal,
        userId: outsider.id,
        role: 'school_admin',
      }),
    ).toEqual(notFound);
    expect(
      await new SendPasswordLink(world).execute({ actor: principal, userId: outsider.id }),
    ).toEqual(notFound);
    expect(await new ListSchoolUsers(world).execute({ actor: teacher })).toEqual(forbidden);
    expect(
      await new ListSchoolUsers(world).execute({
        actor: principal,
        schoolId: outsider.schoolId,
      }),
    ).toEqual(forbidden);
  });

  it('hands one teacher’s classes to another in the same school', async () => {
    const world = adminWorld();
    const { principal, teacher, other } = await schoolWithStaff(world);
    const cls = valueOf(
      await new CreateClass(world).execute({ actor: teacher, details: { name: 'Bio' } }),
    );
    const moved = valueOf(
      await new TransferClasses(world).execute({
        actor: principal,
        fromUserId: teacher.id,
        toUserId: other.id,
      }),
    );
    expect(moved).toBe(1);
    expect((await world.classes.findById(cls.schoolId, cls.id))?.teacherId).toBe(other.id);
    expect(
      await new TransferClasses(world).execute({
        actor: principal,
        fromUserId: other.id,
        toUserId: other.id,
      }),
    ).toEqual({ ok: false, error: { field: 'toUserId', code: 'not_allowed' } });
  });
});

describe('Passwords', () => {
  it('lets a new account choose a password from the emailed link, once', async () => {
    const world = adminWorld();
    const { teacher } = await schoolWithStaff(world);
    const token = linkTokenFor(world, 'tina@lincoln.edu');
    expect(await new SetPassword(world).execute({ token, password: 'short' })).toEqual({
      ok: false,
      error: { field: 'password', code: 'too_short' },
    });
    valueOf(await new SetPassword(world).execute({ token, password: 'a long new password' }));
    expect(
      (await new LogIn(world).execute({ email: teacher.email, password: 'a long new password' }))
        .ok,
    ).toBe(true);
    expect(
      await new SetPassword(world).execute({ token, password: 'another long password' }),
    ).toEqual({ ok: false, error: { code: 'invalid_link' } });
  });

  it('sends a reset link for a known email and answers the same for an unknown one', async () => {
    const world = adminWorld();
    const { user } = await signedUp(world, 'reset@x.edu');
    valueOf(await new RequestPasswordReset(world).execute({ email: 'reset@x.edu' }));
    valueOf(await new RequestPasswordReset(world).execute({ email: 'ghost@x.edu' }));
    expect(world.mailer.outbox.map((m) => m.to)).toEqual(['reset@x.edu']);
    expect(world.mailer.outbox[0]?.text).toMatch(/^reset: /u);

    const first = linkTokenFor(world, user.email);
    valueOf(await new RequestPasswordReset(world).execute({ email: 'reset@x.edu' }));
    expect(
      await new SetPassword(world).execute({ token: first, password: 'a long new password' }),
    ).toEqual({ ok: false, error: { code: 'invalid_link' } });
  });

  it('lets an admin send a reset link to someone in their school', async () => {
    const world = adminWorld();
    const { principal, teacher } = await schoolWithStaff(world);
    const before = world.mailer.outbox.length;
    valueOf(await new SendPasswordLink(world).execute({ actor: principal, userId: teacher.id }));
    expect(world.mailer.outbox.slice(before).map((m) => m.to)).toEqual(['tina@lincoln.edu']);
  });
});

describe('Bulk imports', () => {
  it('imports teachers from a CSV, all or nothing, and welcomes each one', async () => {
    const world = adminWorld();
    const { root, school } = await schoolWithStaff(world);
    const bad = await new ImportTeachers(world).execute({
      actor: root,
      schoolId: school.id,
      csv: 'Name,Email\nAna Ruiz,ana@lincoln.edu\nNo Email,\nTina Again,tina@lincoln.edu\n',
    });
    expect(bad).toEqual({
      ok: false,
      error: {
        code: 'invalid_rows',
        rows: [
          { line: 3, field: 'email', code: 'required' },
          { line: 4, field: 'email', code: 'duplicate' },
        ],
      },
    });
    expect(await world.users.findByEmail('ana@lincoln.edu' as never)).toBeNull();

    const before = world.mailer.outbox.length;
    const done = valueOf(
      await new ImportTeachers(world).execute({
        actor: root,
        schoolId: school.id,
        csv: 'Nombre;Correo;Rol\nAna Ruiz;ana@lincoln.edu;\nLuis Paz;luis@lincoln.edu;school_admin\n',
      }),
    );
    expect(done).toEqual({ imported: 2 });
    expect((await world.users.findByEmail('luis@lincoln.edu' as never))?.role).toBe('school_admin');
    expect(world.mailer.outbox.slice(before).map((m) => m.to)).toEqual([
      'ana@lincoln.edu',
      'luis@lincoln.edu',
    ]);
  });

  it('imports students into a class of any school, and only for a super admin', async () => {
    const world = adminWorld();
    const { root, school, teacher, principal } = await schoolWithStaff(world);
    const cls = valueOf(
      await new CreateClass(world).execute({ actor: teacher, details: { name: 'Bio' } }),
    );
    const csv = 'First name,Last name\nAna,Zayas\nBen,Acosta\n';
    expect(
      valueOf(
        await new ImportSchoolStudents(world).execute({
          actor: root,
          schoolId: school.id,
          classId: cls.id,
          csv,
        }),
      ),
    ).toEqual({ imported: 2 });
    expect(
      await new ImportSchoolStudents(world).execute({
        actor: principal,
        schoolId: school.id,
        classId: cls.id,
        csv,
      }),
    ).toEqual(forbidden);
    expect(
      await new ImportSchoolStudents(world).execute({
        actor: root,
        schoolId: root.schoolId,
        classId: cls.id,
        csv,
      }),
    ).toEqual(notFound);
  });
});
