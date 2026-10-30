import { describe, expect, it } from 'vitest';
import { type ClassId, type SchoolId, type User, type UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { AddStudent, CreateClass, CreatePlan, GetSubPacket, SaveSubPacket } from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

async function classWithRoster(world: World) {
  const actor: User = (await signedUp(world)).user;
  const cls = valueOf(
    await new CreateClass(world).execute({
      actor,
      details: { name: 'Ciencias 5', subject: 'Ciencias' },
    }),
  );
  for (const [firstName, lastName, accommodations] of [
    ['Ana', 'Zayas', 'Extra time'],
    ['Ben', 'Acosta', null],
  ] as const) {
    await new AddStudent(world).execute({
      actor,
      classId: cls.id,
      details: { firstName, lastName, accommodations },
    });
  }
  const plan = valueOf(
    await new CreatePlan(world).execute({
      actor,
      classId: cls.id,
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-08-31', objective: 'Las plantas' }] },
    }),
  );
  await new CreatePlan(world).execute({
    actor,
    body: { kind: 'weekly', weeks: [{ weekStart: '2026-08-31', objective: 'Otra clase' }] },
  });
  return { actor, cls, plan };
}

describe('Substitute packet', () => {
  it('gathers the class, roster, this week’s plan and default notes', async () => {
    const world = makeWorld();
    const { actor, cls, plan } = await classWithRoster(world);

    const packet = valueOf(
      await new GetSubPacket(world).execute({ actor, classId: cls.id, date: '2026-09-01' }),
    );

    expect(packet.cls.id).toBe(cls.id);
    expect(packet.plan?.id).toBe(plan.id);
    expect(packet.students.map((s) => [s.lastName, s.accommodations])).toEqual([
      ['Acosta', null],
      ['Zayas', 'Extra time'],
    ]);
    expect(packet.notes).toMatchObject({ classId: cls.id, includeAccommodations: true });
    expect(packet.semester).toBeNull();
  });

  it('saves the notes, and hides accommodations when the teacher turns them off', async () => {
    const world = makeWorld();
    const { actor, cls } = await classWithRoster(world);

    const saved = await new SaveSubPacket(world).execute({
      actor,
      classId: cls.id,
      details: {
        dailyRoutines: 'Line up at 8:00',
        nurseExt: 'Ext. 105',
        includeAccommodations: false,
      },
    });
    expect(saved.ok).toBe(true);

    const packet = valueOf(
      await new GetSubPacket(world).execute({ actor, classId: cls.id, date: '2026-09-21' }),
    );
    expect(packet.notes).toMatchObject({ dailyRoutines: 'Line up at 8:00', nurseExt: 'Ext. 105' });
    expect(packet.students.every((s) => s.accommodations === null)).toBe(true);
    expect(packet.plan).toBeNull();
  });

  it('rejects invalid notes and dates', async () => {
    const world = makeWorld();
    const { actor, cls } = await classWithRoster(world);
    expect(
      await new SaveSubPacket(world).execute({
        actor,
        classId: cls.id,
        details: { nurseExt: 'x'.repeat(41) },
      }),
    ).toEqual({ ok: false, error: { field: 'nurseExt', code: 'too_long' } });
    expect(
      await new GetSubPacket(world).execute({ actor, classId: cls.id, date: 'yesterday' }),
    ).toEqual({ ok: false, error: { field: 'date', code: 'invalid_format' } });
  });

  it('lets a school admin in, but not another teacher or another school', async () => {
    const world = makeWorld();
    const { actor, cls } = await classWithRoster(world);
    const input = { classId: cls.id, date: '2026-09-01' };

    expect(
      (
        await new GetSubPacket(world).execute({
          actor: colleagueOf(actor, 'school_admin'),
          ...input,
        })
      ).ok,
    ).toBe(true);
    expect(await new GetSubPacket(world).execute({ actor: colleagueOf(actor), ...input })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await new GetSubPacket(world).execute({ actor: outsider, ...input })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await new SaveSubPacket(world).execute({ actor: outsider, classId: cls.id, details: {} }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(
      await new GetSubPacket(world).execute({
        actor,
        classId: 'missing' as ClassId,
        date: '2026-09-01',
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
