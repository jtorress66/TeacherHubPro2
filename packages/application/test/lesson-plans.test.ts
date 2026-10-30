import { describe, expect, it } from 'vitest';
import {
  err,
  ok,
  type ClassId,
  type JobId,
  type PlanFolderId,
  type PlanTemplateId,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import { aClass, aUser, aWeeklyDraft, FakeLessonPlanDrafter } from '@thp/testing';
import {
  CreateClass,
  CreateFolder,
  CreatePlan,
  DeleteFolder,
  DeletePlan,
  DeleteTemplate,
  DuplicatePlan,
  GetDraftedPlan,
  GetJob,
  GetPlan,
  JobHandlerRegistry,
  LessonPlanDraftHandler,
  ListFolders,
  ListPlans,
  ListTemplates,
  MovePlan,
  RequestLessonPlanDraft,
  RunNextJob,
  SaveAsTemplate,
  StartFromTemplate,
  UpdateFolder,
  UpdatePlan,
  draftJobKind,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };
const week = (weekStart = '2026-09-07') => ({
  kind: 'weekly' as const,
  weeks: [{ weekStart, objective: 'Fractions' }],
});
const draftInput = {
  kind: 'weekly',
  subject: 'math',
  grade: '4',
  topic: 'Fractions',
  language: 'es',
  start: '2026-09-07',
};

async function teacher(world: World): Promise<User> {
  return (await signedUp(world)).user;
}

const createPlan = async (world: World, actor: User, extra: object = {}) =>
  valueOf(await new CreatePlan(world).execute({ actor, body: week(), ...extra }));

describe('AI drafts', () => {
  it('queues a draft job with only the plan’s details', async () => {
    const world = makeWorld();
    const actor = await teacher(world);

    const job = valueOf(await new RequestLessonPlanDraft(world).execute({ actor, ...draftInput }));

    expect(job).toMatchObject({ kind: draftJobKind, status: 'queued', ownerId: actor.id });
    expect(job.payload).toEqual({
      kind: 'weekly',
      subject: 'math',
      grade: '4',
      topic: 'Fractions',
      difficulty: 'medium',
      durationMinutes: 45,
      language: 'es',
      instructions: null,
      start: '2026-09-07',
      classId: null,
    });
  });

  it('needs an active subscription or trial', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    advanceDays(world, 8);

    expect(await new RequestLessonPlanDraft(world).execute({ actor, ...draftInput })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
    expect(
      await new RequestLessonPlanDraft(world).execute({ actor: outsider, ...draftInput }),
    ).toEqual({ ok: false, error: { code: 'subscription_required' } });
  });

  it('checks the request and its class', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const request = (extra: object) =>
      new RequestLessonPlanDraft(world).execute({ actor, ...draftInput, ...extra });
    const cls = aClass({
      id: 'class-9' as ClassId,
      schoolId: actor.schoolId,
      teacherId: 'someone-else' as UserId,
    });
    await world.classes.save(cls);

    expect(await request({ topic: '' })).toEqual({
      ok: false,
      error: { field: 'topic', code: 'required' },
    });
    expect(await request({ classId: 'missing' as ClassId })).toEqual(notFound);
    expect(await request({ classId: cls.id })).toEqual(forbidden);
  });

  it('runs through the worker into a plan the teacher saves', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const drafter = new FakeLessonPlanDrafter(ok(aWeeklyDraft()));
    const job = valueOf(await new RequestLessonPlanDraft(world).execute({ actor, ...draftInput }));
    const handlers = new JobHandlerRegistry([new LessonPlanDraftHandler(drafter)]);

    expect(await new RunNextJob({ jobs: world.jobs, handlers }).execute()).toBe('completed');
    expect(drafter.requests[0]).toMatchObject({ topic: 'Fractions', language: 'es' });
    expect(valueOf(await new GetJob(world).execute({ actor, jobId: job.id })).status).toBe(
      'completed',
    );

    const drafted = valueOf(await new GetDraftedPlan(world).execute({ actor, jobId: job.id }));
    expect(await world.lessonPlans.listByTeacher(actor.schoolId, actor.id)).toEqual([]);
    const plan = valueOf(await new CreatePlan(world).execute({ actor, ...drafted }));
    expect(plan.body.kind === 'weekly' && plan.body.weeks[0]).toMatchObject({
      weekStart: '2026-09-07',
      objective: 'Compare fractions',
      standards: ['CCSS.Math.Content.4.NF.A.1'],
    });
  });

  it('stores the drafter’s failure, and fails a job with a broken request', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const failing = new LessonPlanDraftHandler(
      new FakeLessonPlanDrafter(err({ code: 'invalid_output' })),
    );
    const job = valueOf(await new RequestLessonPlanDraft(world).execute({ actor, ...draftInput }));

    expect(await failing.handle(job)).toEqual(err({ code: 'invalid_output' }));
    expect(await failing.handle({ ...job, payload: { kind: 'quiz' } })).toEqual(
      err({ code: 'failed' }),
    );
  });

  it('shows a draft only to its owner, and only once it is finished', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const job = valueOf(await new RequestLessonPlanDraft(world).execute({ actor, ...draftInput }));
    const drafted = (who: User, jobId: JobId = job.id) =>
      new GetDraftedPlan(world).execute({ actor: who, jobId });

    expect(await drafted(actor)).toEqual(notFound);
    await new RunNextJob({
      jobs: world.jobs,
      handlers: new JobHandlerRegistry([
        new LessonPlanDraftHandler(new FakeLessonPlanDrafter(ok(aWeeklyDraft()))),
      ]),
    }).execute();
    expect((await drafted(actor)).ok).toBe(true);
    expect(await drafted(colleagueOf(actor))).toEqual(notFound);
    expect(await drafted(outsider)).toEqual(notFound);

    const other = await world.jobs.enqueue({
      schoolId: actor.schoolId,
      ownerId: actor.id,
      kind: 'grading',
      payload: {},
    });
    await world.jobs.complete(other.id, {});
    expect(await drafted(actor, other.id)).toEqual(notFound);
  });
});

describe('lesson plans', () => {
  it('creates, reads, updates and deletes a teacher’s plan', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor, { title: 'Week 1' });

    expect(valueOf(await new GetPlan(world).execute({ actor, planId: plan.id }))).toEqual(plan);
    const updated = valueOf(
      await new UpdatePlan(world).execute({
        actor,
        planId: plan.id,
        title: 'Changed',
        body: week('2026-09-14'),
      }),
    );
    expect(updated).toMatchObject({ id: plan.id, title: 'Changed' });
    expect(
      await new UpdatePlan(world).execute({ actor, planId: plan.id, body: week('2026-09-15') }),
    ).toEqual({ ok: false, error: { field: 'weeks.0.weekStart', code: 'not_allowed' } });

    expect(await new DeletePlan(world).execute({ actor, planId: plan.id })).toEqual(ok(true));
    expect(await new GetPlan(world).execute({ actor, planId: plan.id })).toEqual(notFound);
  });

  it('refuses invalid content', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    expect(
      await new CreatePlan(world).execute({
        actor,
        body: { kind: 'conversational_english', lessonDate: '2026-09-08' },
      }),
    ).toEqual({ ok: false, error: { field: 'title', code: 'required' } });
  });

  it('lets a school admin open a teacher’s plan, but not another teacher or school', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor);
    const get = (who: User) => new GetPlan(world).execute({ actor: who, planId: plan.id });

    expect((await get(colleagueOf(actor, 'school_admin'))).ok).toBe(true);
    expect(await get(colleagueOf(actor))).toEqual(forbidden);
    expect(await get(outsider)).toEqual(notFound);
    expect(await new DeletePlan(world).execute({ actor: outsider, planId: plan.id })).toEqual(
      notFound,
    );
    expect(
      await new UpdatePlan(world).execute({
        actor: colleagueOf(actor),
        planId: plan.id,
        body: week(),
      }),
    ).toEqual(forbidden);
  });

  it('links only the teacher’s own classes and folders', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const colleague = colleagueOf(actor);
    const theirFolder = valueOf(
      await new CreateFolder(world).execute({ actor: colleague, name: 'Theirs' }),
    );
    const theirClass = aClass({
      id: 'class-9' as ClassId,
      schoolId: actor.schoolId,
      teacherId: colleague.id,
    });
    await world.classes.save(theirClass);
    const mine = valueOf(
      await new CreateClass(world).execute({ actor, details: { name: 'Mine' } }),
    );

    expect(
      await new CreatePlan(world).execute({ actor, body: week(), folderId: theirFolder.id }),
    ).toEqual(notFound);
    expect(
      await new CreatePlan(world).execute({ actor, body: week(), classId: theirClass.id }),
    ).toEqual(forbidden);
    expect((await createPlan(world, actor, { classId: mine.id })).classId).toBe(mine.id);
  });

  it('lists the teacher’s plans, latest first, by folder', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const folder = valueOf(await new CreateFolder(world).execute({ actor, name: 'Unit 1' }));
    const early = await createPlan(world, actor, { folderId: folder.id });
    const late = await createPlan(world, actor, { body: week('2026-09-21') });
    await createPlan(world, colleagueOf(actor));
    const list = (filter?: 'all' | 'unfiled' | PlanFolderId) =>
      new ListPlans(world).execute({ actor, ...(filter ? { filter } : {}) });

    expect((await list()).map((p) => p.id)).toEqual([late.id, early.id]);
    expect((await list('unfiled')).map((p) => p.id)).toEqual([late.id]);
    expect((await list(folder.id)).map((p) => p.id)).toEqual([early.id]);
  });

  it('duplicates a two-week plan to another Monday, keeping both weeks', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor, {
      body: { kind: 'weekly', weeks: [{ weekStart: '2026-09-07' }, { weekStart: '2026-09-14' }] },
    });
    const duplicate = (start: string, who: User = actor) =>
      new DuplicatePlan(world).execute({ actor: who, planId: plan.id, start });

    const copy = valueOf(await duplicate('2026-09-21'));
    expect(copy.id).not.toBe(plan.id);
    expect(copy.body.kind === 'weekly' && copy.body.weeks.map((w) => w.weekStart)).toEqual([
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(await duplicate('2026-09-22')).toEqual({
      ok: false,
      error: { field: 'weeks.0.weekStart', code: 'not_allowed' },
    });
    expect(await duplicate('soon')).toEqual({
      ok: false,
      error: { field: 'start', code: 'invalid_format' },
    });
    expect(await duplicate('2026-09-21', outsider)).toEqual(notFound);
  });

  it('moves a plan between its teacher’s folders and Unfiled', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor);
    const folder = valueOf(await new CreateFolder(world).execute({ actor, name: 'Unit 1' }));
    const theirs = valueOf(
      await new CreateFolder(world).execute({ actor: colleagueOf(actor), name: 'Theirs' }),
    );
    const move = (folderId: PlanFolderId | null, who: User = actor) =>
      new MovePlan(world).execute({ actor: who, planId: plan.id, folderId });

    expect(valueOf(await move(folder.id)).folderId).toBe(folder.id);
    expect(valueOf(await move(null)).folderId).toBeNull();
    expect(await move(theirs.id)).toEqual(notFound);
    expect(await move(folder.id, outsider)).toEqual(notFound);
  });
});

describe('plan folders', () => {
  it('lists the teacher’s folders by name with their plan counts', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const b = valueOf(await new CreateFolder(world).execute({ actor, name: 'B', color: 'rose' }));
    const a = valueOf(await new CreateFolder(world).execute({ actor, name: 'A' }));
    await new CreateFolder(world).execute({ actor: colleagueOf(actor), name: 'Theirs' });
    await createPlan(world, actor, { folderId: b.id });

    expect(await new ListFolders(world).execute({ actor })).toEqual([
      { folder: a, planCount: 0 },
      { folder: b, planCount: 1 },
    ]);
    expect(await new CreateFolder(world).execute({ actor, name: ' ' })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
  });

  it('renames and recolours only the teacher’s own folder', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const folder = valueOf(await new CreateFolder(world).execute({ actor, name: 'A' }));
    const update = (who: User) =>
      new UpdateFolder(world).execute({ actor: who, folderId: folder.id, name: 'B', color: 'sky' });

    expect(await update(colleagueOf(actor))).toEqual(notFound);
    expect(await update(outsider)).toEqual(notFound);
    expect(valueOf(await update(actor))).toMatchObject({ name: 'B', color: 'sky' });
  });

  it('deleting a folder moves its plans to Unfiled', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const folder = valueOf(await new CreateFolder(world).execute({ actor, name: 'A' }));
    const plan = await createPlan(world, actor, { folderId: folder.id });

    expect(await new DeleteFolder(world).execute({ actor: outsider, folderId: folder.id })).toEqual(
      notFound,
    );
    expect(await new DeleteFolder(world).execute({ actor, folderId: folder.id })).toEqual(ok(true));
    expect(await new ListFolders(world).execute({ actor })).toEqual([]);
    expect(
      valueOf(await new GetPlan(world).execute({ actor, planId: plan.id })).folderId,
    ).toBeNull();
  });
});

describe('templates', () => {
  it('lists this week’s starter, all starters and the teacher’s own templates', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor, { title: 'Fractions' });
    const saved = valueOf(
      await new SaveAsTemplate(world).execute({ actor, planId: plan.id, name: 'My week' }),
    );
    await new SaveAsTemplate(world).execute({
      actor: colleagueOf(actor, 'school_admin'),
      planId: plan.id,
      name: 'Admin copy',
    });

    const list = await new ListTemplates(world).execute({ actor });
    expect(list.starters).toHaveLength(5);
    expect(list.starters).toContain(list.featured);
    expect(list.own).toEqual([saved]);
    expect(
      await new SaveAsTemplate(world).execute({ actor: outsider, planId: plan.id, name: 'x' }),
    ).toEqual(notFound);
    expect(await new SaveAsTemplate(world).execute({ actor, planId: plan.id, name: '' })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
  });

  it('starts a plan from a starter in the teacher’s language, on the chosen week', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const start = (starterId: string, date = '2026-09-14') =>
      new StartFromTemplate(world).execute({
        actor,
        source: { starterId },
        start: date,
        language: 'es',
      });

    const drafted = valueOf(await start('fractions-intro'));
    expect(drafted.body).toMatchObject({ kind: 'weekly', unit: 'Introducción a las fracciones' });
    expect(drafted.body.kind === 'weekly' && drafted.body.weeks[0]?.weekStart).toBe('2026-09-14');
    expect((await new CreatePlan(world).execute({ actor, ...drafted })).ok).toBe(true);
    expect(await start('missing')).toEqual(notFound);
    expect(await start('fractions-intro', 'next week')).toEqual({
      ok: false,
      error: { field: 'start', code: 'invalid_format' },
    });
  });

  it('starts a plan from the teacher’s own template, moved to the chosen date', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor, { title: 'Fractions' });
    const template = valueOf(
      await new SaveAsTemplate(world).execute({ actor, planId: plan.id, name: 'Mine' }),
    );
    const start = (who: User, templateId: PlanTemplateId = template.id) =>
      new StartFromTemplate(world).execute({
        actor: who,
        source: { templateId },
        start: '2026-10-05',
        language: 'en',
      });

    const drafted = valueOf(await start(actor));
    expect(drafted.title).toBe('Fractions');
    expect(drafted.body.kind === 'weekly' && drafted.body.weeks[0]?.weekStart).toBe('2026-10-05');
    expect(await start(colleagueOf(actor))).toEqual(notFound);
    expect(await start(outsider)).toEqual(notFound);
  });

  it('deletes only the teacher’s own template', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const plan = await createPlan(world, actor);
    const template = valueOf(
      await new SaveAsTemplate(world).execute({ actor, planId: plan.id, name: 'Mine' }),
    );
    const remove = (who: User) =>
      new DeleteTemplate(world).execute({ actor: who, templateId: template.id });

    expect(await remove(colleagueOf(actor))).toEqual(notFound);
    expect(await remove(actor)).toEqual(ok(true));
    expect((await new ListTemplates(world).execute({ actor })).own).toEqual([]);
  });
});
