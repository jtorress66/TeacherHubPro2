import { describe, expect, it } from 'vitest';
import {
  err,
  ok,
  type Email,
  type PrepBatchId,
  type PrepRequestInput,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import {
  aPresentationDraft,
  aUser,
  aWeeklyDraft,
  FakeContentWriter,
  FakeLessonPlanDrafter,
  FakeMailer,
  FakePresentationDrafter,
  FakeQuizWriter,
} from '@thp/testing';
import {
  CountReadyPrepBatches,
  CreatePlan,
  DeletePrepBatch,
  GetPrepBatch,
  JobHandlerRegistry,
  ListPrepBatches,
  makePrepRunners,
  PrepStepHandler,
  PublishPrepBatch,
  ResumePrepBatch,
  RunNextJob,
  StartPrepBatch,
  UpdatePrepSelection,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };

interface AiFakes {
  readonly drafter: FakeLessonPlanDrafter;
  readonly presentationDrafter: FakePresentationDrafter;
  readonly contentWriter: FakeContentWriter;
  readonly quizWriter: FakeQuizWriter;
}

function aiFakes(overrides: Partial<AiFakes> = {}): AiFakes {
  return {
    drafter: new FakeLessonPlanDrafter(
      ok(aWeeklyDraft({ days: [{ theme: 'Causes' }, { theme: 'Battles' }, {}, {}, {}] })),
    ),
    presentationDrafter: new FakePresentationDrafter(ok(aPresentationDraft())),
    contentWriter: new FakeContentWriter(ok('# Worksheet\n\n1. Name a cause.')),
    quizWriter: new FakeQuizWriter(),
    ...overrides,
  };
}

async function teacherWithClass(world: World) {
  const setup = await gradedClass(world);
  await world.students.save({ ...setup.ana, parentEmail: 'ana.mom@x.edu' as Email });
  await world.students.save({ ...setup.ben, parentEmail: 'ben.dad@x.edu' as Email });
  const input: PrepRequestInput = {
    classId: setup.cls.id,
    prompt: 'Prep next week for Unit 3 History (Civil War)',
    weekStart: '2026-09-07',
    subject: 'social_studies',
    grade: '7',
    days: 2,
    options: { presentations: true, worksheets: true, quiz: true, parentEmail: true },
    quizCategoryId: setup.category('Pruebas cortas'),
    language: 'es',
    emailTemplate: {
      subject: 'Esta semana en Ciencias 5',
      greeting: 'Queridas familias:',
      intro: 'Esto aprenderemos esta semana:',
      quizLine: 'El viernes habrá una prueba corta.',
      signOff: 'Saludos,\nAna López',
      dayLabels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    },
  };
  return { ...setup, input };
}

/** Runs queued prep steps until none is left; returns how many ran. */
async function runSteps(world: World, fakes = aiFakes()) {
  const run = new RunNextJob({
    jobs: world.jobs,
    handlers: new JobHandlerRegistry([
      new PrepStepHandler({ ...world, runners: makePrepRunners({ ...world, ...fakes }) }),
    ]),
  });
  let count = 0;
  while ((await run.execute()) !== 'idle') count += 1;
  return count;
}

async function readyBatch(world: World, fakes = aiFakes()) {
  const setup = await teacherWithClass(world);
  const batch = valueOf(
    await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }),
  );
  await runSteps(world, fakes);
  const ref = { actor: setup.actor, batchId: batch.id };
  return { ...setup, batch, ref, fakes };
}

describe('StartPrepBatch', () => {
  it('saves a running batch and queues its first step', async () => {
    const world = makeWorld();
    const { actor, input } = await teacherWithClass(world);
    const batch = valueOf(await new StartPrepBatch(world).execute({ actor, request: input }));
    expect(batch).toMatchObject({ status: 'running', teacherId: actor.id, classId: input.classId });
    expect(batch.items.map((i) => i.key)).toEqual([
      'plan',
      'presentation-1',
      'worksheet-1',
      'presentation-2',
      'worksheet-2',
      'quiz',
    ]);
    const job = await world.jobs.findForOwner(actor.schoolId, actor.id, batch.jobId);
    expect(job).toMatchObject({ kind: 'prep.step', payload: { batchId: batch.id } });
  });

  it('refuses another school, a colleague, a category of another class and no subscription', async () => {
    const world = makeWorld();
    const { actor, input } = await teacherWithClass(world);
    expect(await new StartPrepBatch(world).execute({ actor: outsider, request: input })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
    expect(
      (await new StartPrepBatch(world).execute({ actor: colleagueOf(actor), request: input })).ok,
    ).toBe(false);
    expect(
      await new StartPrepBatch(world).execute({
        actor,
        request: { ...input, quizCategoryId: 'other' as never },
      }),
    ).toEqual({ ok: false, error: { field: 'quizCategoryId', code: 'not_allowed' } });
    expect(
      await new StartPrepBatch(world).execute({ actor, request: { ...input, days: 9 } }),
    ).toEqual({ ok: false, error: { field: 'days', code: 'out_of_range' } });
    advanceDays(world, 60);
    expect(await new StartPrepBatch(world).execute({ actor, request: input })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });
});

describe('PrepStepHandler', () => {
  it('runs one item per job, then drafts the parent email and is ready', async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    const batch = valueOf(
      await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }),
    );
    const fakes = aiFakes();
    expect(await runSteps(world, fakes)).toBe(6);

    const view = valueOf(
      await new GetPrepBatch(world).execute({ actor: setup.actor, batchId: batch.id }),
    );
    expect(view.batch.status).toBe('ready');
    expect(view.progress).toEqual({ step: 4, done: 6, total: 6 });
    expect(view.recipients).toBe(2);
    expect(view.stalled).toBe(false);
    expect(view.batch.parentEmail?.body).toContain('• Lunes: Causes\n• Martes: Battles');
    expect(view.batch.parentEmail?.body).toContain('El viernes habrá una prueba corta.');

    expect(fakes.drafter.requests[0]).toMatchObject({
      kind: 'weekly',
      subject: 'social_studies',
      grade: '7',
      topic: 'Prep next week for Unit 3 History (Civil War)',
      start: '2026-09-07',
      language: 'es',
    });
    expect(fakes.presentationDrafter.requests.map((r) => r.topic)).toEqual(['Causes', 'Battles']);
    expect(fakes.contentWriter.requests.map((r) => [r.type, r.topic])).toEqual([
      ['worksheet', 'Causes'],
      ['worksheet', 'Battles'],
    ]);
    expect(fakes.quizWriter.requests).toEqual([
      {
        subject: 'social_studies',
        grade: '7',
        topics: ['Causes', 'Battles'],
        questionCount: 10,
        language: 'es',
      },
    ]);
  });

  it('never sends the AI student names or parent emails', async () => {
    const world = makeWorld();
    const { fakes } = await readyBatch(world);
    const sent = JSON.stringify([
      fakes.drafter.requests,
      fakes.presentationDrafter.requests,
      fakes.contentWriter.requests,
      fakes.quizWriter.requests,
    ]);
    for (const secret of ['Zayas', 'Acosta', 'ana.mom@x.edu', 'Ana']) {
      expect(sent).not.toContain(secret);
    }
  });

  it("tells the planner about last week's plan for the class", async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    valueOf(
      await new CreatePlan(world).execute({
        actor: setup.actor,
        classId: setup.cls.id,
        body: {
          kind: 'weekly',
          unit: 'Westward expansion',
          weeks: [{ weekStart: '2026-08-31', objective: 'Explain manifest destiny' }],
        },
      }),
    );
    valueOf(await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }));
    const fakes = aiFakes();
    await runSteps(world, fakes);
    expect(fakes.drafter.requests[0]?.instructions).toContain(
      'Last week: Westward expansion — Explain manifest destiny',
    );
  });

  it('skips a failed slide deck but fails the batch when the plan fails', async () => {
    const world = makeWorld();
    const { ref } = await readyBatch(
      world,
      aiFakes({
        presentationDrafter: new FakePresentationDrafter(err({ code: 'invalid_output' })),
      }),
    );
    const view = valueOf(await new GetPrepBatch(world).execute(ref));
    expect(view.batch.status).toBe('ready');
    expect(view.batch.items.filter((i) => i.status === 'failed').map((i) => i.key)).toEqual([
      'presentation-1',
      'presentation-2',
    ]);

    const other = makeWorld();
    const failing = await readyBatch(
      other,
      aiFakes({ drafter: new FakeLessonPlanDrafter(err({ code: 'ai_unavailable' })) }),
    );
    const failed = valueOf(await new GetPrepBatch(other).execute(failing.ref));
    expect(failed.batch.status).toBe('failed');
    expect(failed.progress.done).toBe(1);
  });
});

describe('ResumePrepBatch', () => {
  it('queues the step again when its job failed, and retries a failed plan', async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    const batch = valueOf(
      await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }),
    );
    const ref = { actor: setup.actor, batchId: batch.id };
    expect(await new ResumePrepBatch(world).execute(ref)).toEqual({
      ok: false,
      error: { field: 'status', code: 'not_allowed' },
    });

    await world.jobs.fail(batch.jobId, 'timed_out');
    expect(valueOf(await new GetPrepBatch(world).execute(ref)).stalled).toBe(true);
    const resumed = valueOf(await new ResumePrepBatch(world).execute(ref));
    expect(resumed.jobId).not.toBe(batch.jobId);
    await runSteps(world);
    expect(valueOf(await new GetPrepBatch(world).execute(ref)).batch.status).toBe('ready');

    const other = makeWorld();
    const failing = await readyBatch(
      other,
      aiFakes({ drafter: new FakeLessonPlanDrafter(err({ code: 'ai_unavailable' })) }),
    );
    valueOf(await new ResumePrepBatch(other).execute(failing.ref));
    await runSteps(other);
    expect(valueOf(await new GetPrepBatch(other).execute(failing.ref)).batch.status).toBe('ready');
  });
});

describe('Reviewing a batch', () => {
  it('lists the teacher’s batches, counts the ready ones, and keeps the chosen items and email', async () => {
    const world = makeWorld();
    const { ref } = await readyBatch(world);
    expect(
      (await new ListPrepBatches(world).execute({ actor: ref.actor })).map((b) => b.id),
    ).toEqual([ref.batchId]);
    expect(await new CountReadyPrepBatches(world).execute({ actor: ref.actor })).toBe(1);

    const updated = valueOf(
      await new UpdatePrepSelection(world).execute({
        ...ref,
        keep: ['plan', 'presentation-1', 'quiz'],
        email: { subject: 'Semana 3', body: 'Hola familias' },
      }),
    );
    expect(updated.items.filter((i) => i.include).map((i) => i.key)).toEqual([
      'plan',
      'presentation-1',
      'quiz',
    ]);
    expect(updated.parentEmail).toEqual({ subject: 'Semana 3', body: 'Hola familias' });
    expect(
      await new UpdatePrepSelection(world).execute({
        ...ref,
        keep: [],
        email: { subject: '', body: 'x' },
      }),
    ).toEqual({ ok: false, error: { field: 'subject', code: 'required' } });
  });

  it("never shows, changes or deletes a colleague's or another school's batch", async () => {
    const world = makeWorld();
    const { ref } = await readyBatch(world);
    for (const actor of [
      outsider,
      colleagueOf(ref.actor),
      colleagueOf(ref.actor, 'school_admin'),
    ]) {
      const other = { ...ref, actor };
      expect(await new GetPrepBatch(world).execute(other)).toEqual(notFound);
      expect(await new UpdatePrepSelection(world).execute({ ...other, keep: [] })).toEqual(
        notFound,
      );
      expect(await new PublishPrepBatch(world).execute(other)).toEqual(notFound);
      expect(await new ResumePrepBatch(world).execute(other)).toEqual(notFound);
      expect(await new DeletePrepBatch(world).execute(other)).toEqual(notFound);
      expect(await new ListPrepBatches(world).execute({ actor })).toEqual([]);
    }
    expect(
      await new GetPrepBatch(world).execute({ ...ref, batchId: 'nope' as PrepBatchId }),
    ).toEqual(notFound);
    valueOf(await new DeletePrepBatch(world).execute(ref));
    expect(await new GetPrepBatch(world).execute(ref)).toEqual(notFound);
  });
});

describe('PublishPrepBatch', () => {
  it('saves the kept plan, slides, worksheets and quiz, and emails each family once', async () => {
    const world = makeWorld();
    const { ref, cls, category } = await readyBatch(world);
    valueOf(
      await new UpdatePrepSelection(world).execute({
        ...ref,
        keep: ['plan', 'presentation-1', 'worksheet-2', 'quiz'],
      }),
    );

    const published = valueOf(await new PublishPrepBatch(world).execute(ref));
    expect(published.status).toBe('published');
    expect(published.published).toMatchObject({ emailsSent: 2, emailsFailed: 0 });

    const plans = await world.lessonPlans.listByTeacher(ref.actor.schoolId, ref.actor.id);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: published.published?.planId, classId: cls.id });
    expect(plans[0]?.body.kind === 'weekly' && plans[0].body.weeks[0]?.weekStart).toBe(
      '2026-09-07',
    );
    expect(plans[0]?.body.kind === 'weekly' && plans[0].body.weeks[0]?.days).toHaveLength(5);

    const decks = await world.presentations.listByTeacher(ref.actor.schoolId, ref.actor.id);
    expect(decks.map((d) => d.id)).toEqual(published.published?.presentationIds);
    const sheets = await world.generations.listByTeacher(ref.actor.schoolId, ref.actor.id);
    expect(sheets.map((g) => [g.type, g.topic])).toEqual([['worksheet', 'Battles']]);

    const quiz = await world.assignments.findById(
      ref.actor.schoolId,
      published.published?.assignmentId ?? ('' as never),
    );
    expect(quiz).toMatchObject({
      classId: cls.id,
      categoryId: category('Pruebas cortas'),
      dueDate: '2026-09-11',
    });
    expect(quiz?.questions).toHaveLength(2);

    expect(world.mailer.outbox.map((m) => m.to).sort()).toEqual(['ana.mom@x.edu', 'ben.dad@x.edu']);
    expect(world.mailer.outbox[0]?.subject).toBe('[es] Esta semana en Ciencias 5');

    expect(await new PublishPrepBatch(world).execute(ref)).toEqual({
      ok: false,
      error: { field: 'status', code: 'not_allowed' },
    });
    expect(world.mailer.outbox).toHaveLength(2);
  });

  it('sends nothing without the email option, and counts refused emails', async () => {
    const world = makeWorld();
    const { ref } = await readyBatch(world);
    const rejecting = { ...world, mailer: new FakeMailer({ reject: true }) };
    const published = valueOf(await new PublishPrepBatch(rejecting).execute(ref));
    expect(published.published).toMatchObject({ emailsSent: 0, emailsFailed: 2 });

    const other = makeWorld();
    const setup = await teacherWithClass(other);
    const batch = valueOf(
      await new StartPrepBatch(other).execute({
        actor: setup.actor,
        request: {
          ...setup.input,
          options: { presentations: false, worksheets: false, quiz: false, parentEmail: false },
          quizCategoryId: null,
        },
      }),
    );
    await runSteps(other);
    const quiet = valueOf(
      await new PublishPrepBatch(other).execute({ actor: setup.actor, batchId: batch.id }),
    );
    expect(quiet.published).toMatchObject({ assignmentId: null, emailsSent: 0, emailsFailed: 0 });
    expect(other.mailer.outbox).toEqual([]);
  });

  it('refuses a batch that is not ready', async () => {
    const world = makeWorld();
    const setup = await teacherWithClass(world);
    const batch = valueOf(
      await new StartPrepBatch(world).execute({ actor: setup.actor, request: setup.input }),
    );
    expect(
      await new PublishPrepBatch(world).execute({ actor: setup.actor, batchId: batch.id }),
    ).toEqual({ ok: false, error: { field: 'status', code: 'not_allowed' } });
  });
});
