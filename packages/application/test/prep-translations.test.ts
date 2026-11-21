import { describe, expect, it } from 'vitest';
import { FakeMessageTranslator } from '@thp/testing';
import {
  aiDraftJobKinds,
  GetPrepBatch,
  JobHandlerRegistry,
  PublishPrepBatch,
  RequestEmailTranslations,
  RunNextJob,
  TranslateEmailHandler,
  translateEmailJobKind,
  UpdatePrepSelection,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { readyBatch } from './prep-setup.ts';
import { makeWorld, type World } from './world.ts';

/** The value a test set up, which must be there. */
function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing test data');
  return value;
}

/** A ready batch (in Spanish) where Ana's family reads Chinese and Ben's the teacher's language. */
async function batchWithChineseFamily(world: World) {
  const setup = await readyBatch(world);
  const ana = present(await world.students.findById(setup.actor.schoolId, setup.ana.id));
  await world.students.save({ ...ana, familyLanguage: 'zh' });
  return setup;
}

async function runTranslations(world: World, translator = new FakeMessageTranslator()) {
  const run = new RunNextJob({
    jobs: world.jobs,
    handlers: new JobHandlerRegistry([
      new TranslateEmailHandler({ ...world, messageTranslator: translator }),
    ]),
  });
  while ((await run.execute()) !== 'idle');
  return translator;
}

const emailOf = async (world: World, ref: Parameters<GetPrepBatch['execute']>[0]) =>
  valueOf(await new GetPrepBatch(world).execute(ref)).batch;

describe('Translating the family email', () => {
  it("shows which families read another language than the email's", async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    expect(valueOf(await new GetPrepBatch(world).execute(ref)).familyLanguages).toEqual([
      { language: 'zh', families: 1 },
    ]);
  });

  it("drafts the email in each family's language, from the teacher's language", async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    const started = valueOf(await new RequestEmailTranslations(world).execute(ref));
    expect(started.translations?.status).toBe('running');

    const translator = await runTranslations(world);
    expect(translator.requests.map((r) => [r.from, r.to])).toEqual([['es', 'zh']]);
    expect(translator.requests[0]?.email).toEqual(started.parentEmail);
    const batch = await emailOf(world, ref);
    expect(batch.translations).toMatchObject({
      status: 'ready',
      items: [{ language: 'zh', subject: '[zh] Esta semana en Ciencias 5' }],
    });
  });

  it('counts as an AI draft on the School overview', () => {
    expect(aiDraftJobKinds).toContain(translateEmailJobKind);
  });

  it('records a failure, so the teacher can try again', async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    valueOf(await new RequestEmailTranslations(world).execute(ref));
    await runTranslations(world, new FakeMessageTranslator({ code: 'ai_unavailable' }));
    expect((await emailOf(world, ref)).translations?.status).toBe('failed');
  });

  it('refuses when no family reads another language, or the school turned AI off', async () => {
    const world = makeWorld();
    const { ref } = await readyBatch(world);
    expect(await new RequestEmailTranslations(world).execute(ref)).toEqual({
      ok: false,
      error: { field: 'languages', code: 'required' },
    });

    const school = present(await world.schools.findById(ref.actor.schoolId));
    await world.schools.save({ ...school, features: { ai: false, studentFlags: true } });
    expect(await new RequestEmailTranslations(world).execute(ref)).toEqual({
      ok: false,
      error: { code: 'ai_off_for_school' },
    });
  });

  it("never reaches a colleague's or another school's batch", async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    const notFound = { ok: false, error: { code: 'not_found' } };
    expect(
      await new RequestEmailTranslations(world).execute({ ...ref, actor: colleagueOf(ref.actor) }),
    ).toEqual(notFound);
    expect(
      await new RequestEmailTranslations(world).execute({
        ...ref,
        actor: { ...ref.actor, schoolId: 'school-9' as never },
      }),
    ).toEqual(notFound);
  });

  it('keeps the teacher’s edits, and refuses them once the email has changed', async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    valueOf(await new RequestEmailTranslations(world).execute(ref));
    await runTranslations(world);
    const batch = await emailOf(world, ref);
    const email = present(batch.parentEmail);
    const keep = batch.items.map((item) => item.key);
    const edit = { language: 'zh' as const, subject: '本周', body: '各位家长：' };

    valueOf(
      await new UpdatePrepSelection(world).execute({ ...ref, keep, email, translations: [edit] }),
    );
    expect((await emailOf(world, ref)).translations?.items).toEqual([edit]);

    expect(
      await new UpdatePrepSelection(world).execute({
        ...ref,
        keep,
        email: { ...email, body: 'Otro texto' },
        translations: [edit],
      }),
    ).toEqual({ ok: false, error: { code: 'translations_outdated' } });
    expect((await emailOf(world, ref)).parentEmail).toEqual(email);
  });

  it("sends each family the email in its language, and the others the teacher's", async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    valueOf(await new RequestEmailTranslations(world).execute(ref));
    await runTranslations(world);

    const published = valueOf(await new PublishPrepBatch(world).execute(ref));
    expect(published.published).toMatchObject({ emailsSent: 2, emailsFailed: 0 });
    const sent = Object.fromEntries(world.mailer.outbox.map((m) => [m.to, m.subject]));
    expect(sent).toEqual({
      'ana.mom@x.edu': '[zh] [zh] Esta semana en Ciencias 5',
      'ben.dad@x.edu': '[es] Esta semana en Ciencias 5',
    });
  });

  it("sends the teacher's email to every family when nothing was translated", async () => {
    const world = makeWorld();
    const { ref } = await batchWithChineseFamily(world);
    valueOf(await new PublishPrepBatch(world).execute(ref));
    expect(world.mailer.outbox.map((m) => m.subject)).toEqual([
      '[es] Esta semana en Ciencias 5',
      '[es] Esta semana en Ciencias 5',
    ]);
  });
});
