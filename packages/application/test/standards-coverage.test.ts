import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  ArchiveClass,
  CreateClass,
  CreateGame,
  CreatePlan,
  GetSchoolStandardsCoverage,
  GetStandardsCoverage,
  ListPlannedStandards,
  SetAssignmentStandards,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const fractions = 'CCSS.Math.Content.4.NF.A.1';
const forbidden = { ok: false, error: { code: 'forbidden' } };

/** A class that planned two standards, tested one, and graded it: Ana 9/10, Ben 5/10. */
async function coveredClass(world = makeWorld(), email?: string) {
  const setup = await gradedClass(world, email);
  const { actor, cls } = setup;
  valueOf(
    await new CreatePlan(world).execute({
      actor,
      classId: cls.id,
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
  const quiz = await setup.assign('Fracciones', 'Pruebas cortas', 10);
  valueOf(
    await new SetAssignmentStandards(world).execute({
      actor,
      classId: cls.id,
      assignmentId: quiz.id,
      standards: [fractions],
    }),
  );
  await setup.grade(quiz.id, [
    { studentId: setup.ana.id, status: 'graded', score: 9 },
    { studentId: setup.ben.id, status: 'graded', score: 5 },
    { studentId: setup.cara.id, status: 'missing' },
  ]);
  return { world, setup, base: { actor, classId: cls.id } };
}

describe('GetStandardsCoverage', () => {
  it("shows each planned standard with the class's results on the assignments that test it", async () => {
    const { world, base } = await coveredClass();

    const report = valueOf(await new GetStandardsCoverage(world).execute(base));

    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toMatchObject({
      standard: { code: fractions, source: 'common_core' },
      plannedWeeks: ['2026-11-02'],
      assignments: 1,
      average: 70,
      studentsScored: 2,
      studentsBelow: 1,
      status: 'watch',
    });
    expect(report.rows[1]).toMatchObject({
      standard: { code: '4.N.1.1', source: 'puerto_rico' },
      assignments: 0,
      average: null,
      status: 'not_tested',
    });
    expect(report.summary).toEqual({
      reteach: 0,
      watch: 1,
      on_track: 0,
      practised: 0,
      not_tested: 1,
    });
  });

  it("counts the class's games that practise each standard; one only a game practises is practised", async () => {
    const { world, setup, base } = await coveredClass();
    const quiz = (standards: string[]) => ({
      kind: 'questions' as const,
      items: ['Half?', 'Third?', 'Quarter?'].map((prompt, index) => ({
        prompt,
        options: ['Yes', 'No'],
        answer: 0,
        ...(index === 0 ? { standards } : {}),
      })),
    });
    for (const [title, classId, standards] of [
      ['Fractions race', setup.cls.id, [fractions, '4.N.2.3']],
      ['Unshared', null, ['NOT.SHARED']],
    ] as const) {
      valueOf(
        await new CreateGame(world).execute({
          actor: setup.actor,
          title,
          mode: 'quiz',
          content: quiz([...standards]),
          classId,
        }),
      );
    }

    const report = valueOf(await new GetStandardsCoverage(world).execute(base));

    expect(report.rows.map((row) => [row.standard.code, row.games, row.status])).toEqual([
      [fractions, 1, 'watch'],
      ['4.N.1.1', 0, 'not_tested'],
      ['4.N.2.3', 1, 'practised'],
    ]);
    expect(report.summary.practised).toBe(1);
  });

  it('lets a school admin see it, but not another teacher or another school', async () => {
    const { world, setup, base } = await coveredClass();
    const get = new GetStandardsCoverage(world);

    expect(
      (await get.execute({ ...base, actor: colleagueOf(setup.actor, 'school_admin') })).ok,
    ).toBe(true);
    expect(await get.execute({ ...base, actor: colleagueOf(setup.actor) })).toEqual(forbidden);
    expect(await get.execute({ ...base, actor: outsider })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('GetSchoolStandardsCoverage', () => {
  it("counts each active class's standards by status for the school's admins", async () => {
    const { world, setup } = await coveredClass();
    const { actor } = setup;
    const empty = valueOf(
      await new CreateClass(world).execute({ actor, details: { name: 'Arte 5' } }),
    );
    const archived = valueOf(
      await new CreateClass(world).execute({ actor, details: { name: 'Viejo' } }),
    );
    valueOf(
      await new CreatePlan(world).execute({
        actor,
        classId: archived.id,
        body: { kind: 'weekly', weeks: [{ weekStart: '2026-11-02', standards: [fractions] }] },
      }),
    );
    valueOf(await new ArchiveClass(world).execute({ actor, classId: archived.id }));

    const school = valueOf(await new GetSchoolStandardsCoverage(world).execute({ actor }));

    expect(school.classes).toEqual([
      {
        classId: setup.cls.id,
        name: 'Ciencias 5',
        summary: { reteach: 0, watch: 1, on_track: 0, practised: 0, not_tested: 1 },
      },
    ]);
    expect(school.classes.map((c) => c.classId)).not.toContain(empty.id);
  });

  it("keeps teachers out and never shows another school's classes", async () => {
    const { world, setup } = await coveredClass();
    const otherSchool = await coveredClass(world, 'other@school.edu');

    expect(
      await new GetSchoolStandardsCoverage(world).execute({ actor: colleagueOf(setup.actor) }),
    ).toEqual(forbidden);
    const mine = valueOf(
      await new GetSchoolStandardsCoverage(world).execute({ actor: setup.actor }),
    );
    expect(mine.classes.map((c) => c.classId)).toEqual([setup.cls.id]);
    expect(otherSchool.setup.actor.schoolId).not.toBe(setup.actor.schoolId);
  });
});

describe('ListPlannedStandards', () => {
  it("offers the codes in the teacher's own lesson plans, and nothing to another school", async () => {
    const { world, setup } = await coveredClass();

    const codes = await new ListPlannedStandards(world).execute({ actor: setup.actor });

    expect(codes.map((info) => info.code)).toEqual([fractions, '4.N.1.1']);
    expect(await new ListPlannedStandards(world).execute({ actor: outsider })).toEqual([]);
  });
});
