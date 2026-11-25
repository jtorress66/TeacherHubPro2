import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { CreatePlan, GetAssignmentStandards, SetAssignmentStandards } from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const fractions = 'CCSS.Math.Content.4.NF.A.1';

async function taggedSetup() {
  const world = makeWorld();
  const setup = await gradedClass(world);
  const assignment = await setup.assign('Fractions quiz', 'Pruebas cortas', 20);
  const base = { actor: setup.actor, classId: setup.cls.id, assignmentId: assignment.id };
  valueOf(
    await new CreatePlan(world).execute({
      actor: setup.actor,
      classId: setup.cls.id,
      body: {
        kind: 'weekly',
        weeks: [
          {
            weekStart: '2026-11-02',
            standards: [fractions],
            domainStandards: { other: ['4.N.1.1'] },
          },
        ],
      },
    }),
  );
  return { world, setup, base };
}

describe('assignment standards', () => {
  it('suggests the codes planned for the class and keeps the ones the teacher picks', async () => {
    const { world, base } = await taggedSetup();
    const get = new GetAssignmentStandards(world);

    const before = valueOf(await get.execute(base));
    expect(before.standards).toEqual([]);
    expect(before.suggestions.map((s) => s.code)).toEqual([fractions, '4.N.1.1']);
    expect(before.suggestions.map((s) => s.source)).toEqual(['common_core', 'puerto_rico']);

    valueOf(
      await new SetAssignmentStandards(world).execute({
        ...base,
        standards: [fractions, 'MY.CODE.1'],
      }),
    );

    const after = valueOf(await get.execute(base));
    expect(after.standards).toEqual([
      expect.objectContaining({ code: fractions, source: 'common_core' }),
      { code: 'MY.CODE.1', source: 'typed', description: null },
    ]);
    expect(after.suggestions.map((s) => s.code)).toEqual(['4.N.1.1']);
  });

  it('refuses codes that break the rules', async () => {
    const { world, base } = await taggedSetup();

    expect(
      await new SetAssignmentStandards(world).execute({ ...base, standards: ['4 NF'] }),
    ).toEqual({ ok: false, error: { field: 'standards', code: 'invalid_format' } });
  });

  it('lets a school admin see them, but not another teacher or another school', async () => {
    const { world, setup, base } = await taggedSetup();

    expect(
      (
        await new GetAssignmentStandards(world).execute({
          ...base,
          actor: colleagueOf(setup.actor, 'school_admin'),
        })
      ).ok,
    ).toBe(true);
    expect(
      await new SetAssignmentStandards(world).execute({
        ...base,
        actor: colleagueOf(setup.actor),
        standards: [fractions],
      }),
    ).toEqual({ ok: false, error: { code: 'forbidden' } });
    expect(await new GetAssignmentStandards(world).execute({ ...base, actor: outsider })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await new SetAssignmentStandards(world).execute({
        ...base,
        actor: outsider,
        standards: [fractions],
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
