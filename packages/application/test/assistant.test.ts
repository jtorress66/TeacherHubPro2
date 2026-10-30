import { describe, expect, it } from 'vitest';
import {
  err,
  ok,
  type GenerationId,
  type JobId,
  type PresentationId,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import {
  aPresentationDraft,
  aUser,
  FakeContentWriter,
  FakePresentationDrafter,
  FakeTextToSpeech,
} from '@thp/testing';
import {
  CreatePresentation,
  DeleteGeneration,
  DeletePresentation,
  GenerationHandler,
  GetGeneration,
  GetPresentation,
  GetSpeechClip,
  JobHandlerRegistry,
  ListGenerations,
  ListPresentations,
  PresentationDraftHandler,
  RequestGeneration,
  RequestPresentationDraft,
  RequestSpeech,
  RunNextJob,
  SpeechHandler,
  UpdatePresentation,
  generationJobKind,
  presentationDraftJobKind,
  speechJobKind,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const subscriptionRequired = { ok: false, error: { code: 'subscription_required' } };

const worksheetInput = {
  type: 'worksheet',
  subject: 'math',
  grade: '4',
  topic: 'Fracciones',
  language: 'es',
};
const slidesInput = { topic: 'Volcanes', subject: 'science', grade: '5', language: 'es' };

const teacher = async (world: World): Promise<User> => (await signedUp(world)).user;

/** Runs every queued job with the given handlers. */
async function runJobs(
  world: World,
  ...handlers: ConstructorParameters<typeof JobHandlerRegistry>[0]
) {
  const run = new RunNextJob({ jobs: world.jobs, handlers: new JobHandlerRegistry(handlers) });
  while ((await run.execute()) !== 'idle') {
    // keep going until the queue is empty
  }
}

const generationHandler = (world: World, content = '# Hoja\n\n1. ___') =>
  new GenerationHandler({ ...world, writer: new FakeContentWriter(ok(content)) });

describe('AI assistant', () => {
  it('queues a generation with only the request’s details', async () => {
    const world = makeWorld();
    const actor = await teacher(world);

    const job = valueOf(await new RequestGeneration(world).execute({ actor, ...worksheetInput }));

    expect(job).toMatchObject({ kind: generationJobKind, ownerId: actor.id });
    expect(job.payload).toEqual({
      type: 'worksheet',
      subject: 'math',
      grade: '4',
      topic: 'Fracciones',
      difficulty: 'medium',
      durationMinutes: null,
      questionCount: null,
      language: 'es',
      instructions: null,
    });
  });

  it('needs an active subscription or trial, and valid input', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    expect(
      await new RequestGeneration(world).execute({ actor, ...worksheetInput, type: 'essay' }),
    ).toEqual({ ok: false, error: { field: 'type', code: 'not_allowed' } });
    advanceDays(world, 8);
    expect(await new RequestGeneration(world).execute({ actor, ...worksheetInput })).toEqual(
      subscriptionRequired,
    );
  });

  it('saves the written content in the teacher’s history, and the job points to it', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const job = valueOf(await new RequestGeneration(world).execute({ actor, ...worksheetInput }));

    await runJobs(world, generationHandler(world));

    const done = await world.jobs.findForOwner(actor.schoolId, actor.id, job.id);
    expect(done?.status).toBe('completed');
    const { generationId } = done?.result as { generationId: GenerationId };
    const generation = valueOf(await new GetGeneration(world).execute({ actor, generationId }));
    expect(generation).toMatchObject({
      teacherId: actor.id,
      type: 'worksheet',
      topic: 'Fracciones',
      content: '# Hoja\n\n1. ___',
    });
    expect(valueOf(await new ListGenerations(world).execute({ actor })).map((g) => g.id)).toEqual([
      generationId,
    ]);
  });

  it('fails the job with the writer’s safe code', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const job = valueOf(await new RequestGeneration(world).execute({ actor, ...worksheetInput }));
    const writer = new FakeContentWriter(err({ code: 'invalid_output' }));

    await runJobs(world, new GenerationHandler({ ...world, writer }));

    const done = await world.jobs.findForOwner(actor.schoolId, actor.id, job.id);
    expect(done).toMatchObject({ status: 'failed', error: 'invalid_output' });
  });

  it('keeps each teacher’s history private, and deletes only their own', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    await new RequestGeneration(world).execute({ actor, ...worksheetInput });
    await runJobs(world, generationHandler(world));
    const [generation] = valueOf(await new ListGenerations(world).execute({ actor }));
    if (generation === undefined) throw new Error('no generation');
    const generationId = generation.id;

    for (const other of [colleagueOf(actor), colleagueOf(actor, 'school_admin'), outsider]) {
      expect(await new GetGeneration(world).execute({ actor: other, generationId })).toEqual(
        notFound,
      );
      expect(await new DeleteGeneration(world).execute({ actor: other, generationId })).toEqual(
        notFound,
      );
      expect(valueOf(await new ListGenerations(world).execute({ actor: other }))).toEqual([]);
    }

    expect(await new DeleteGeneration(world).execute({ actor, generationId })).toEqual(ok(true));
    expect(await new GetGeneration(world).execute({ actor, generationId })).toEqual(notFound);
  });
});

describe('Presentations', () => {
  const draftHandler = () =>
    new PresentationDraftHandler(new FakePresentationDrafter(ok(aPresentationDraft())));

  async function draftedJob(world: World, actor: User): Promise<JobId> {
    const job = valueOf(
      await new RequestPresentationDraft(world).execute({ actor, ...slidesInput, slideCount: 3 }),
    );
    await runJobs(world, draftHandler());
    return job.id;
  }

  it('queues a slide draft with only the request’s details, and needs AI access', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const job = valueOf(
      await new RequestPresentationDraft(world).execute({ actor, ...slidesInput }),
    );
    expect(job).toMatchObject({ kind: presentationDraftJobKind });
    expect(job.payload).toEqual({ ...slidesInput, slideCount: 6, theme: 'ocean' });

    advanceDays(world, 8);
    expect(await new RequestPresentationDraft(world).execute({ actor, ...slidesInput })).toEqual(
      subscriptionRequired,
    );
  });

  it('creates a presentation from the teacher’s finished draft', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const jobId = await draftedJob(world, actor);

    const presentation = valueOf(await new CreatePresentation(world).execute({ actor, jobId }));

    expect(presentation).toMatchObject({
      teacherId: actor.id,
      name: 'Volcanoes',
      topic: 'Volcanes',
      subject: 'science',
      grade: '5',
      theme: 'ocean',
    });
    expect(presentation.slides.map((s) => s.layout)).toEqual(['title', 'content', 'quote']);
  });

  it('never creates from another user’s or an unfinished draft', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const jobId = await draftedJob(world, actor);
    const queued = valueOf(
      await new RequestPresentationDraft(world).execute({ actor, ...slidesInput }),
    );

    for (const other of [colleagueOf(actor), outsider]) {
      expect(await new CreatePresentation(world).execute({ actor: other, jobId })).toEqual(
        notFound,
      );
    }
    expect(await new CreatePresentation(world).execute({ actor, jobId: queued.id })).toEqual(
      notFound,
    );
  });

  it('creates a blank presentation with one title slide', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const presentation = valueOf(
      await new CreatePresentation(world).execute({ actor, name: 'Mi clase', theme: 'forest' }),
    );
    expect(presentation).toMatchObject({ name: 'Mi clase', theme: 'forest' });
    expect(presentation.slides).toEqual([
      expect.objectContaining({ layout: 'title', title: 'Mi clase' }),
    ]);
  });

  it('edits, lists and deletes the teacher’s own presentations only', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const created = valueOf(
      await new CreatePresentation(world).execute({ actor, name: 'Plantas' }),
    );
    const presentationId = created.id;
    world.clock.advanceBy(60_000);

    const renamed = valueOf(
      await new UpdatePresentation(world).execute({
        actor,
        presentationId,
        changes: { name: 'Las plantas', theme: 'candy' },
      }),
    );
    expect(renamed).toMatchObject({ name: 'Las plantas', theme: 'candy', slides: created.slides });
    expect(renamed.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());

    const edited = valueOf(
      await new UpdatePresentation(world).execute({
        actor,
        presentationId,
        changes: { slides: [{ layout: 'content', title: 'Raíces', emoji: '🌱' }] },
      }),
    );
    expect(edited.slides.map((s) => s.title)).toEqual(['Raíces']);
    expect(
      await new UpdatePresentation(world).execute({
        actor,
        presentationId,
        changes: { slides: [] },
      }),
    ).toEqual({ ok: false, error: { field: 'slides', code: 'out_of_range' } });

    expect(valueOf(await new ListPresentations(world).execute({ actor }))).toEqual([
      expect.objectContaining({ id: presentationId, slideCount: 1 }),
    ]);

    for (const other of [colleagueOf(actor), colleagueOf(actor, 'school_admin'), outsider]) {
      expect(await new GetPresentation(world).execute({ actor: other, presentationId })).toEqual(
        notFound,
      );
      expect(
        await new UpdatePresentation(world).execute({
          actor: other,
          presentationId,
          changes: { name: 'x' },
        }),
      ).toEqual(notFound);
      expect(await new DeletePresentation(world).execute({ actor: other, presentationId })).toEqual(
        notFound,
      );
    }

    expect(await new DeletePresentation(world).execute({ actor, presentationId })).toEqual(
      ok(true),
    );
    expect(
      await new GetPresentation(world).execute({
        actor,
        presentationId: 'missing' as PresentationId,
      }),
    ).toEqual(notFound);
  });
});

describe('Read aloud', () => {
  const speechDeps = (world: World) => ({ ...world, voice: 'nova' });

  it('queues the parts that are not cached yet, then serves them from the cache', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const tts = new FakeTextToSpeech();

    const first = valueOf(
      await new RequestSpeech(speechDeps(world)).execute({
        actor,
        text: '# Hola\n\nBuenos días.',
        language: 'es',
      }),
    );
    expect(first.status).toBe('queued');
    if (first.status !== 'queued') throw new Error('expected a job');
    expect(first.job.kind).toBe(speechJobKind);

    await runJobs(world, new SpeechHandler({ ...world, tts }));
    expect(tts.requests).toEqual([{ text: 'Hola\n\nBuenos días.', voice: 'nova', language: 'es' }]);
    const done = await world.jobs.findForOwner(actor.schoolId, actor.id, first.job.id);
    expect(done?.result).toEqual({ clips: first.clips });

    const again = valueOf(
      await new RequestSpeech(speechDeps(world)).execute({
        actor,
        text: '# Hola\n\nBuenos días.',
        language: 'es',
      }),
    );
    expect(again).toEqual({ status: 'ready', clips: first.clips });

    const [clipId] = first.clips;
    if (clipId === undefined) throw new Error('no clip');
    const audio = valueOf(await new GetSpeechClip(world).execute({ actor, clipId }));
    expect(audio.contentType).toBe('audio/mpeg');
    expect(new TextDecoder().decode(audio.bytes)).toBe('Hola\n\nBuenos días.');
  });

  it('keeps each school’s audio apart and refuses malformed clip ids', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const queued = valueOf(
      await new RequestSpeech(speechDeps(world)).execute({ actor, text: 'Hola', language: 'es' }),
    );
    await runJobs(world, new SpeechHandler({ ...world, tts: new FakeTextToSpeech() }));
    const [clipId] = queued.clips;
    if (clipId === undefined) throw new Error('no clip');

    expect(await new GetSpeechClip(world).execute({ actor: outsider, clipId })).toEqual(notFound);
    expect(await new GetSpeechClip(world).execute({ actor, clipId: '../school-9/secret' })).toEqual(
      notFound,
    );
  });

  it('needs AI access and speakable text', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    expect(
      await new RequestSpeech(speechDeps(world)).execute({ actor, text: ' # ', language: 'es' }),
    ).toEqual({ ok: false, error: { field: 'text', code: 'required' } });
    advanceDays(world, 8);
    expect(
      await new RequestSpeech(speechDeps(world)).execute({ actor, text: 'Hola', language: 'es' }),
    ).toEqual(subscriptionRequired);
  });

  it('fails the job as ai_unavailable when the voice service fails', async () => {
    const world = makeWorld();
    const actor = await teacher(world);
    const queued = valueOf(
      await new RequestSpeech(speechDeps(world)).execute({ actor, text: 'Hola', language: 'es' }),
    );
    if (queued.status !== 'queued') throw new Error('expected a job');
    await runJobs(world, new SpeechHandler({ ...world, tts: new FakeTextToSpeech('unavailable') }));

    const done = await world.jobs.findForOwner(actor.schoolId, actor.id, queued.job.id);
    expect(done).toMatchObject({ status: 'failed', error: 'ai_unavailable' });
  });
});
