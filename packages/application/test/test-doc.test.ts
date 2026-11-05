import { describe, expect, it } from 'vitest';
import { ok, type JobId, type TestLayout } from '@thp/domain';
import {
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleDrive,
  FakePdfTextExtractor,
  FakeTestTranscriber,
  FakeSecretCipher,
} from '@thp/testing';
import {
  FinishClassroomConnect,
  GetTranscribedTest,
  JobHandlerRegistry,
  MakeTestDoc,
  TestDocHandler,
  testDocJobKind,
  PostDocToClassroom,
  RequestDocImport,
  RequestQuizImport,
  RunNextJob,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const pdf = new TextEncoder().encode('%PDF test');
const layout: TestLayout = {
  blocks: [
    { kind: 'part', title: 'A. Matching Definitions (5 points)' },
    {
      kind: 'columns',
      rows: [
        ['______ 1. risks', 'a. to feel uncomfortable or ashamed'],
        ['______ 2. capable', 'b. the chance of something bad'],
      ],
    },
  ],
};

async function teacher(world: World, drive = new FakeGoogleDrive()) {
  const { user: actor } = await signedUp(world);
  const classroom = new FakeClassroom({
    accessToken: 'classroom-access',
    course: { id: 'course-1', name: 'English', section: null },
    roster: [],
  });
  const all = {
    ...world,
    cipher: new FakeSecretCipher(),
    classroomAuth: new FakeClassroomAuthorization(),
    classroomCoursework: classroom,
    googleDrive: drive,
  };
  valueOf(
    await new FinishClassroomConnect(all).execute({
      actor,
      code: 'classroom-code',
      redirectUri: 'https://app.test/api/classroom/callback',
    }),
  );
  const request = (changes: Partial<Parameters<RequestDocImport['execute']>[0]> = {}) =>
    new RequestDocImport(all).execute({
      actor,
      courseId: 'course-1',
      title: 'Chapter 3 – Try It!',
      instructions: 'Type your answers.',
      dueDate: '2026-12-01',
      pdf,
      ...changes,
    });
  const transcriber = new FakeTestTranscriber(ok(layout));
  const read = async (
    pdfText = new FakePdfTextExtractor([{ pdf, text: 'Test text', pageCount: 1 }]),
  ) => {
    await new RunNextJob({
      jobs: world.jobs,
      handlers: new JobHandlerRegistry([
        new TestDocHandler({ ...world, pdfText, testTranscriber: transcriber }),
      ]),
    }).execute();
  };
  return { actor, all, classroom, drive, request, read, transcriber };
}

describe('A test as a Google Doc students type in', () => {
  it('copies the test as printed into a Doc, and posts it so each student gets a copy', async () => {
    const world = makeWorld();
    const { actor, all, classroom, drive, request, read, transcriber } = await teacher(world);

    const job = valueOf(await request());
    expect(job).toMatchObject({ kind: testDocJobKind, ownerId: actor.id });
    await read();
    expect(transcriber.texts).toEqual(['Test text']);
    expect(valueOf(await new GetTranscribedTest(world).execute({ actor, jobId: job.id }))).toEqual({
      title: 'Chapter 3 – Try It!',
      layout,
      classroom: {
        courseId: 'course-1',
        instructions: 'Type your answers.',
        dueDate: '2026-12-01',
      },
    });

    const doc = valueOf(await new MakeTestDoc(all).execute({ actor, jobId: job.id }));
    expect(doc).toEqual({ docId: 'doc-1', url: 'https://docs.test/doc-1/edit' });
    expect(drive.docs[0]?.name).toBe('Chapter 3 – Try It!');
    // The definitions keep their printed letters, so the teacher's answer key still fits.
    expect(drive.docs[0]?.html).toContain(
      '<tr><td>______ 1. risks</td><td>a. to feel uncomfortable or ashamed</td></tr>',
    );

    const posted = valueOf(
      await new PostDocToClassroom(all).execute({ actor, jobId: job.id, docId: doc.docId }),
    );
    expect(posted.url).toContain('classroom.test');
    expect(classroom.coursework.at(-1)).toEqual({
      title: 'Chapter 3 – Try It!',
      description: 'Type your answers.',
      material: { kind: 'driveFile', driveFileId: 'doc-1' },
      dueDate: '2026-12-01',
    });
  });

  it('checks the details before reading the PDF, and needs AI access', async () => {
    const world = makeWorld();
    const { request } = await teacher(world);
    expect(await request({ courseId: '' })).toEqual({
      ok: false,
      error: { field: 'courseId', code: 'required' },
    });
    expect(await request({ title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(await request({ dueDate: '1/12/2026' })).toEqual({
      ok: false,
      error: { field: 'dueDate', code: 'invalid_format' },
    });
    expect(await request({ pdf: new Uint8Array() })).toEqual({
      ok: false,
      error: { field: 'pdf', code: 'too_large' },
    });
    advanceDays(world, 8);
    expect(await request()).toEqual({ ok: false, error: { code: 'subscription_required' } });
  });

  it("cannot use another teacher's job, an unfinished one, or one not meant for Classroom", async () => {
    const world = makeWorld();
    const { actor, all, request, read } = await teacher(world);
    const job = valueOf(await request());
    const notFound = { ok: false, error: { code: 'not_found' } };

    expect(await new MakeTestDoc(all).execute({ actor, jobId: job.id })).toEqual(notFound);
    await read();
    expect(
      await new MakeTestDoc(all).execute({ actor: colleagueOf(actor), jobId: job.id }),
    ).toEqual(notFound);
    expect(
      await new PostDocToClassroom(all).execute({
        actor: colleagueOf(actor),
        jobId: job.id,
        docId: 'doc-1',
      }),
    ).toEqual(notFound);

    const quiz = valueOf(await new RequestQuizImport(world).execute({ actor, title: 'Q', pdf }));
    await read();
    expect(await new MakeTestDoc(all).execute({ actor, jobId: quiz.id })).toEqual(notFound);
    expect(await new MakeTestDoc(all).execute({ actor, jobId: 'missing' as JobId })).toEqual(
      notFound,
    );
  });

  it('names the fix when Google refuses the Doc', async () => {
    const world = makeWorld();
    const { actor, all, request, read } = await teacher(
      world,
      new FakeGoogleDrive({ accessToken: 'classroom-access', failWith: 'api_disabled' }),
    );
    const job = valueOf(await request());
    await read();
    expect(await new MakeTestDoc(all).execute({ actor, jobId: job.id })).toEqual({
      ok: false,
      error: { code: 'google_api_disabled' },
    });
  });

  it('reports a Classroom failure when posting', async () => {
    const world = makeWorld();
    const { actor, all, request, read } = await teacher(world);
    const job = valueOf(await request({ courseId: 'gone' }));
    await read();
    expect(
      await new PostDocToClassroom(all).execute({ actor, jobId: job.id, docId: 'doc-1' }),
    ).toEqual({ ok: false, error: { code: 'classroom_failed' } });
  });

  it('fails the job clearly for a PDF without text or one it cannot read, and removes the PDF', async () => {
    const world = makeWorld();
    const { actor, request, read } = await teacher(world);
    const blank = new TextEncoder().encode('%PDF scanned');
    const job = valueOf(await request({ pdf: blank }));
    await read(new FakePdfTextExtractor([{ pdf: blank, text: '  ', pageCount: 1 }]));
    expect(await world.jobs.findForOwner(actor.schoolId, actor.id, job.id)).toMatchObject({
      status: 'failed',
      error: 'pdf_no_text',
    });
    expect((await world.files.get((job.payload as { fileKey: string }).fileKey)).ok).toBe(false);

    const unreadable = valueOf(await request({ pdf: new Uint8Array([1, 2]) }));
    await read();
    expect(await world.jobs.findForOwner(actor.schoolId, actor.id, unreadable.id)).toMatchObject({
      error: 'pdf_unreadable',
    });
  });
});
