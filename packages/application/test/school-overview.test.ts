import { describe, expect, it } from 'vitest';
import type { User } from '@thp/domain';
import {
  GetCommandCenter,
  GetSchoolOverview,
  GetStudent360,
  RequestGeneration,
  RequestSpeech,
  RequestStudentInsight,
  SetSchoolFeatures,
  aiDraftJobKinds,
  generationJobKind,
  speechJobKind,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const timeZone = 'America/Puerto_Rico';
const forbidden = { ok: false, error: { code: 'forbidden' } };
const worksheet = {
  type: 'worksheet',
  subject: 'math',
  grade: '4',
  topic: 'Fracciones',
  language: 'es',
};

async function owner(world: World, email?: string): Promise<User> {
  return (await signedUp(world, email)).user;
}

const turnOff = async (
  world: World,
  actor: User,
  features: { ai: boolean; studentFlags: boolean },
) => valueOf(await new SetSchoolFeatures(world).execute({ actor, features }));

describe('GetSchoolOverview', () => {
  it("gives the owner each person's counts for the last 30 days, the totals and the switches", async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await world.schoolUsage.seed({
      schoolId: actor.schoolId,
      teachers: [
        {
          id: actor.id,
          name: 'Ana López',
          lastActiveAt: world.clock.now(),
          classes: [{ students: 3 }],
        },
      ],
    });

    const overview = valueOf(await new GetSchoolOverview(world).execute({ actor }));

    expect(overview.teachers).toEqual([
      expect.objectContaining({ teacherId: actor.id, name: 'Ana López', classes: 1, students: 3 }),
    ]);
    expect(overview.totals).toEqual({
      teachers: 1,
      activeTeachers: 1,
      students: 3,
      aiDrafts: 0,
      attendanceDays: 0,
    });
    expect(overview.features).toEqual({ ai: true, studentFlags: true });
  });

  it('asks only for its own school, counting every kind of AI draft and nothing else', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    valueOf(await new GetSchoolOverview(world).execute({ actor }));

    const [query] = world.schoolUsage.queries;
    expect(query?.schoolId).toBe(actor.schoolId);
    expect(query?.aiJobKinds).toEqual(aiDraftJobKinds);
    expect(aiDraftJobKinds).toContain(generationJobKind);
    expect(aiDraftJobKinds).not.toContain(speechJobKind);
    expect(aiDraftJobKinds).not.toContain('lti_grade_send');
  });

  it("keeps a teacher who neither runs nor owns the school out, and never shows another school's people", async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const other = await owner(world, 'other@school.edu');
    await world.schoolUsage.seed({
      schoolId: other.schoolId,
      teachers: [{ id: other.id, name: 'Other', lastActiveAt: null }],
    });

    expect(await new GetSchoolOverview(world).execute({ actor: colleagueOf(actor) })).toEqual(
      forbidden,
    );
    const overview = valueOf(await new GetSchoolOverview(world).execute({ actor }));
    expect(overview.teachers).toEqual([]);
  });
});

describe('SetSchoolFeatures', () => {
  it('saves the switches for the whole school and records who changed them', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    const saved = await turnOff(world, actor, { ai: false, studentFlags: true });

    expect(saved).toEqual({ ai: false, studentFlags: true });
    expect((await world.schools.findById(actor.schoolId))?.features).toEqual(saved);
    const events = await world.auditLog.listForSchool(actor.schoolId, 10);
    expect(events.map((event) => [event.action, event.actorId])).toEqual([
      ['school_ai_turned_off', actor.id],
    ]);
  });

  it('records each switch that changed, and nothing when nothing did', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    await turnOff(world, actor, { ai: true, studentFlags: true });
    await turnOff(world, actor, { ai: false, studentFlags: false });
    await turnOff(world, actor, { ai: true, studentFlags: false });

    const events = await world.auditLog.listForSchool(actor.schoolId, 10);
    expect(events.map((event) => event.action).sort()).toEqual([
      'school_ai_turned_off',
      'school_ai_turned_on',
      'school_student_flags_turned_off',
    ]);
  });

  it('refuses a teacher who neither runs nor owns the school', async () => {
    const world = makeWorld();
    const actor = await owner(world);

    expect(
      await new SetSchoolFeatures(world).execute({
        actor: colleagueOf(actor),
        features: { ai: false, studentFlags: false },
      }),
    ).toEqual(forbidden);
    expect((await world.schools.findById(actor.schoolId))?.features.ai).toBe(true);
  });
});

describe('with AI turned off', () => {
  it('refuses every AI draft in that school, and only that school', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    const other = await owner(world, 'other@school.edu');
    await turnOff(world, actor, { ai: false, studentFlags: true });

    expect(await new RequestGeneration(world).execute({ actor, ...worksheet })).toEqual({
      ok: false,
      error: { code: 'ai_off_for_school' },
    });
    expect((await new RequestGeneration(world).execute({ actor: other, ...worksheet })).ok).toBe(
      true,
    );
  });

  it('applies to everyone in the school, a super admin included', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await turnOff(world, actor, { ai: false, studentFlags: true });

    const superAdmin = { ...actor, role: 'super_admin' as const };
    expect(await new RequestGeneration(world).execute({ actor: superAdmin, ...worksheet })).toEqual(
      { ok: false, error: { code: 'ai_off_for_school' } },
    );
  });

  it('still reads text aloud: listening is not drafting', async () => {
    const world = makeWorld();
    const actor = await owner(world);
    await turnOff(world, actor, { ai: false, studentFlags: true });

    const speech = await new RequestSpeech({ ...world, voice: 'nova' }).execute({
      actor,
      text: 'Buenos días.',
      language: 'es',
    });
    expect(speech.ok).toBe(true);
  });
});

describe('with student flags turned off', () => {
  async function struggling(world: World) {
    const setup = await gradedClass(world);
    const quiz = await setup.assign('Quiz', 'Pruebas cortas', 10, '2026-08-25');
    await setup.grade(quiz.id, [{ studentId: setup.ana.id, status: 'graded', score: 1 }]);
    return setup;
  }

  it('shows no one as needing help and suggests no outreach', async () => {
    const world = makeWorld();
    const { actor } = await struggling(world);
    const before = valueOf(await new GetCommandCenter(world).execute({ actor, timeZone }));
    expect(before.studentFlags).toBe(true);
    expect(before.atRisk).toHaveLength(1);

    await turnOff(world, actor, { ai: true, studentFlags: false });
    const center = valueOf(await new GetCommandCenter(world).execute({ actor, timeZone }));

    expect(center.studentFlags).toBe(false);
    expect(center.atRisk).toEqual([]);
    expect(center.stats.atRisk).toBe(0);
    expect(center.recommendations.map((r) => r.kind)).not.toContain('intervention');
  });

  it('hides AI student insights and refuses to draft new ones', async () => {
    const world = makeWorld();
    const { actor, cls, ana } = await struggling(world);
    const ref = { actor, classId: cls.id, studentId: ana.id };
    await turnOff(world, actor, { ai: true, studentFlags: false });

    const view = valueOf(await new GetStudent360(world).execute({ ...ref, timeZone }));
    expect(view.insightsOn).toBe(false);
    expect(view.insight).toBeNull();
    expect(await new RequestStudentInsight(world).execute({ ...ref, timeZone })).toEqual({
      ok: false,
      error: { code: 'student_flags_off' },
    });
  });
});
