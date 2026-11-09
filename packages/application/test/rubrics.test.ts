import { describe, expect, it } from 'vitest';
import { blankRubricDetails, ok, type SchoolId, type User, type UserId } from '@thp/domain';
import { aRubricDraft, aUser, FakeRubricDrafter } from '@thp/testing';
import {
  CreateRubric,
  DeleteRubric,
  GetRubric,
  JobHandlerRegistry,
  ListRubrics,
  RequestRubricDraft,
  RubricDraftHandler,
  RunNextJob,
  UpdateRubric,
  rubricDraftJobKind,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const draftInput = { topic: 'Volcano poster', subject: 'science', grade: '5', language: 'es' };
const teacher = async (world: World): Promise<User> => (await signedUp(world)).user;

const blank = (title = 'Lab report') =>
  blankRubricDetails({
    title,
    criteriaCount: 2,
    levelCount: 3,
    levelLabel: (n) => `Nivel ${String(n)}`,
    criterionName: (n) => `Criterio ${String(n)}`,
  });

async function draftedJob(
  world: World,
  actor: User,
  drafter = new FakeRubricDrafter(ok(aRubricDraft())),
) {
  const job = valueOf(
    await new RequestRubricDraft(world).execute({ actor, ...draftInput, esl: true }),
  );
  const run = new RunNextJob({
    jobs: world.jobs,
    handlers: new JobHandlerRegistry([new RubricDraftHandler(drafter)]),
  });
  while ((await run.execute()) !== 'idle') {
    // keep going until the queue is empty
  }
  return { jobId: job.id, drafter };
}

describe('rubric drafts', () => {
  it('queues a draft with only the request’s details, and needs AI access', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const job = valueOf(await new RequestRubricDraft(world).execute({ actor, ...draftInput }));

    expect(job).toMatchObject({ kind: rubricDraftJobKind, ownerId: actor.id });
    expect(job.payload).toEqual({
      ...draftInput,
      title: null,
      criteriaCount: 4,
      levelCount: 4,
      esl: false,
      instructions: null,
    });

    advanceDays(world, 8);
    expect(await new RequestRubricDraft(world).execute({ actor, ...draftInput })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });

  it('creates a rubric from the teacher’s finished draft, passing on the ESL switch', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const { jobId, drafter } = await draftedJob(world, actor);

    const rubric = valueOf(await new CreateRubric(world).execute({ actor, jobId }));

    expect(drafter.requests[0]).toMatchObject({ topic: 'Volcano poster', esl: true });
    expect(rubric).toMatchObject({
      teacherId: actor.id,
      title: 'Volcano poster',
      subject: 'science',
      grade: '5',
      levels: aRubricDraft().levels,
      criteria: aRubricDraft().criteria,
    });
  });

  it('never creates from another user’s or an unfinished draft', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const { jobId } = await draftedJob(world, actor);
    const queued = valueOf(await new RequestRubricDraft(world).execute({ actor, ...draftInput }));

    for (const other of [colleagueOf(actor), outsider]) {
      expect(await new CreateRubric(world).execute({ actor: other, jobId })).toEqual(notFound);
    }
    expect(await new CreateRubric(world).execute({ actor, jobId: queued.id })).toEqual(notFound);
  });
});

describe('rubrics', () => {
  it('creates a blank grid, edits it, lists and deletes it', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const created = valueOf(await new CreateRubric(world).execute({ actor, details: blank() }));
    expect(created.criteria.map((c) => c.name)).toEqual(['Criterio 1', 'Criterio 2']);
    world.clock.advanceBy(60_000);

    const edited = valueOf(
      await new UpdateRubric(world).execute({
        actor,
        rubricId: created.id,
        details: { ...blank('Informe'), subject: 'science' },
      }),
    );
    expect(edited).toMatchObject({
      title: 'Informe',
      subject: 'science',
      createdAt: created.createdAt,
    });
    expect(
      await new UpdateRubric(world).execute({
        actor,
        rubricId: created.id,
        details: { ...blank(), criteria: [] },
      }),
    ).toEqual({ ok: false, error: { field: 'criteria', code: 'out_of_range' } });

    expect(valueOf(await new ListRubrics(world).execute({ actor })).map((r) => r.id)).toEqual([
      created.id,
    ]);
    expect(valueOf(await new DeleteRubric(world).execute({ actor, rubricId: created.id }))).toBe(
      true,
    );
    expect(await new GetRubric(world).execute({ actor, rubricId: created.id })).toEqual(notFound);
  });

  it('keeps a rubric private: a colleague and another school reach nothing', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const { id: rubricId } = valueOf(
      await new CreateRubric(world).execute({ actor, details: blank() }),
    );

    for (const other of [colleagueOf(actor), outsider]) {
      expect(await new GetRubric(world).execute({ actor: other, rubricId })).toEqual(notFound);
      expect(
        await new UpdateRubric(world).execute({ actor: other, rubricId, details: blank('X') }),
      ).toEqual(notFound);
      expect(await new DeleteRubric(world).execute({ actor: other, rubricId })).toEqual(notFound);
      expect(valueOf(await new ListRubrics(world).execute({ actor: other }))).toEqual([]);
    }
    expect(valueOf(await new GetRubric(world).execute({ actor, rubricId })).title).toBe(
      'Lab report',
    );
  });
});
