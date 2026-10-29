import { describe, expect, it } from 'vitest';
import type { SemesterChanges, SemesterId, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  CreateClass,
  CreateSemester,
  DeleteSemester,
  ListSemesters,
  SetActiveSemester,
  UpdateSemester,
} from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const fall = {
  name: 'Fall',
  startDate: '2026-08-15',
  endDate: '2026-12-20',
  schoolYear: '2026-2027',
};
const spring = { name: 'Spring', startDate: '2027-01-10', endDate: '2027-05-30' };

async function semester(
  world: World,
  actor: User,
  details: SemesterChanges = fall,
  makeActive = false,
) {
  const result = await new CreateSemester(world).execute({ actor, details, makeActive });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe('semesters', () => {
  it('the school owner creates semesters; listing shows the latest first', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    await semester(world, user, fall);
    await semester(world, user, spring);

    const listed = await new ListSemesters(world).execute({ actor: user });
    expect(listed.map((s) => s.name)).toEqual(['Spring', 'Fall']);
  });

  it('setting one active leaves exactly one active, also when created active', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const first = await semester(world, user, fall, true);
    const second = await semester(world, user, spring, true);

    let listed = await new ListSemesters(world).execute({ actor: user });
    expect(listed.filter((s) => s.isActive).map((s) => s.id)).toEqual([second.id]);

    expect(
      (await new SetActiveSemester(world).execute({ actor: user, semesterId: first.id })).ok,
    ).toBe(true);
    listed = await new ListSemesters(world).execute({ actor: user });
    expect(listed.filter((s) => s.isActive).map((s) => s.id)).toEqual([first.id]);
  });

  it('updates a semester and validates its dates', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const created = await semester(world, user);

    const updated = await new UpdateSemester(world).execute({
      actor: user,
      semesterId: created.id,
      details: { ...fall, name: 'Otoño' },
    });
    expect(updated.ok && updated.value.name).toBe('Otoño');
    expect(
      await new UpdateSemester(world).execute({
        actor: user,
        semesterId: created.id,
        details: { ...fall, startDate: '2026-12-31' },
      }),
    ).toEqual({ ok: false, error: { field: 'endDate', code: 'invalid_order' } });
  });

  it('refuses to delete a semester that classes use, and deletes an unused one', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const used = await semester(world, user, fall);
    const unused = await semester(world, user, spring);
    await new CreateClass(world).execute({
      actor: user,
      details: { name: 'Math', semesterId: used.id },
    });

    expect(await new DeleteSemester(world).execute({ actor: user, semesterId: used.id })).toEqual({
      ok: false,
      error: { code: 'semester_in_use' },
    });
    expect(
      (await new DeleteSemester(world).execute({ actor: user, semesterId: unused.id })).ok,
    ).toBe(true);
    expect((await new ListSemesters(world).execute({ actor: user })).map((s) => s.id)).toEqual([
      used.id,
    ]);
  });

  it('only an admin of the school or its owner may change semesters', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const teacher = aUser({ id: 'colleague' as UserId, schoolId: user.schoolId, email: 'c@x.edu' });
    const admin = { ...teacher, id: 'admin' as UserId, role: 'school_admin' as const };

    expect(await new CreateSemester(world).execute({ actor: teacher, details: fall })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect((await new CreateSemester(world).execute({ actor: admin, details: fall })).ok).toBe(
      true,
    );
  });

  it("another school's semester is unreachable (the old app let anyone edit or delete it)", async () => {
    const world = makeWorld();
    const ana = await signedUp(world, 'ana@school.edu');
    const ben = await signedUp(world, 'ben@other.edu');
    const anasSemester = await semester(world, ana.user);

    expect(
      await new UpdateSemester(world).execute({
        actor: ben.user,
        semesterId: anasSemester.id,
        details: spring,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(
      await new DeleteSemester(world).execute({ actor: ben.user, semesterId: anasSemester.id }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await new SetActiveSemester(world).execute({ actor: ben.user, semesterId: anasSemester.id }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(await new ListSemesters(world).execute({ actor: ben.user })).toEqual([]);
  });

  it('reports an unknown semester', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    expect(
      await new DeleteSemester(world).execute({ actor: user, semesterId: 'nope' as SemesterId }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});
