import { describe, expect, it } from 'vitest';
import type { ClassId, SemesterId, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  ArchiveClass,
  CreateClass,
  GetClass,
  ListClasses,
  RestoreClass,
  UpdateClass,
  canManageClass,
} from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const schedule = { period: 2, startTime: '08:50', endTime: '09:40', days: ['Mon', 'Wed', 'Fri'] };

async function withClass(world: World) {
  const account = await signedUp(world);
  const created = await new CreateClass(world).execute({
    actor: account.user,
    details: { name: 'Matemáticas 7', subject: 'Math', grade: '7', schedule },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  return { ...account, cls: created.value };
}

const colleagueOf = (user: User, role: User['role'] = 'teacher') =>
  aUser({
    id: `colleague-${role}` as UserId,
    schoolId: user.schoolId,
    email: `${role}@x.edu`,
    role,
  });

describe('canManageClass', () => {
  it('allows the class teacher, an admin of its school and a super admin', async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);
    const other = await signedUp(world, 'ben@other.edu');

    expect(canManageClass(user, cls)).toBe(true);
    expect(canManageClass(colleagueOf(user, 'school_admin'), cls)).toBe(true);
    expect(canManageClass({ ...other.user, role: 'super_admin' }, cls)).toBe(true);
  });

  it("refuses another teacher, and another school's admin", async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);
    const other = await signedUp(world, 'ben@other.edu');

    expect(canManageClass(colleagueOf(user), cls)).toBe(false);
    expect(canManageClass({ ...other.user, role: 'school_admin' }, cls)).toBe(false);
  });
});

describe('CreateClass and UpdateClass', () => {
  it("creates a class in the teacher's school with its schedule", async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);

    expect(cls).toMatchObject({
      schoolId: user.schoolId,
      teacherId: user.id,
      name: 'Matemáticas 7',
    });
    expect(cls.schedule).toEqual({
      period: 2,
      startTime: '08:50',
      endTime: '09:40',
      days: ['Mon', 'Wed', 'Fri'],
    });
    expect(await world.classes.findById(user.schoolId, cls.id)).toEqual(cls);
  });

  it('school days default to Mon–Fri', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const result = await new CreateClass(world).execute({
      actor: user,
      details: { name: 'Art', schedule: { period: 1 } },
    });
    expect(result.ok && result.value.schedule?.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  });

  it('refuses a blank name and a semester from another school', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    expect(await new CreateClass(world).execute({ actor: user, details: { name: ' ' } })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
    expect(
      await new CreateClass(world).execute({
        actor: user,
        details: { name: 'A', semesterId: 'sem-x' as SemesterId },
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('updates a class the teacher manages', async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);

    const result = await new UpdateClass(world).execute({
      actor: user,
      classId: cls.id,
      details: { name: 'Matemáticas 7B' },
    });
    expect(result.ok && result.value.name).toBe('Matemáticas 7B');
  });

  it("refuses another teacher's update, and another school's class is unreachable", async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);
    const other = await signedUp(world, 'ben@other.edu');

    expect(
      await new UpdateClass(world).execute({
        actor: colleagueOf(user),
        classId: cls.id,
        details: { name: 'X' },
      }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await new UpdateClass(world).execute({
        actor: other.user,
        classId: cls.id,
        details: { name: 'X' },
      }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(await new GetClass(world).execute({ actor: other.user, classId: cls.id })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('archiving and listing', () => {
  it('archiving hides the class from lists and restoring brings it back', async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);

    expect((await new ArchiveClass(world).execute({ actor: user, classId: cls.id })).ok).toBe(true);
    expect(await new ListClasses(world).execute({ actor: user })).toEqual([]);
    const archived = await new ListClasses(world).execute({ actor: user, includeArchived: true });
    expect(archived.map((c) => c.id)).toEqual([cls.id]);
    expect(archived[0]?.archivedAt).toEqual(world.clock.now());

    await new RestoreClass(world).execute({ actor: user, classId: cls.id });
    expect((await new ListClasses(world).execute({ actor: user })).map((c) => c.id)).toEqual([
      cls.id,
    ]);
  });

  it("refuses to archive another teacher's class", async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);

    expect(
      await new ArchiveClass(world).execute({ actor: colleagueOf(user), classId: cls.id }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await new RestoreClass(world).execute({ actor: colleagueOf(user), classId: cls.id }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('a teacher lists their own classes; a school admin lists every class of the school', async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);
    const colleague = colleagueOf(user);
    await new CreateClass(world).execute({ actor: colleague, details: { name: 'Science' } });

    expect((await new ListClasses(world).execute({ actor: user })).map((c) => c.id)).toEqual([
      cls.id,
    ]);
    expect(
      await new ListClasses(world).execute({ actor: colleagueOf(user, 'school_admin') }),
    ).toHaveLength(2);
  });

  it('gets a class the actor manages and refuses one they do not', async () => {
    const world = makeWorld();
    const { user, cls } = await withClass(world);

    expect(await new GetClass(world).execute({ actor: user, classId: cls.id })).toEqual({
      ok: true,
      value: cls,
    });
    expect(
      await new GetClass(world).execute({ actor: colleagueOf(user), classId: cls.id }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await new GetClass(world).execute({ actor: user, classId: 'missing' as ClassId }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});
