import { describe, expect, it } from 'vitest';
import { ok, type ExtractedTest, type JobId, type QuestionId } from '@thp/domain';
import {
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleDrive,
  FakePdfTextExtractor,
  FakeQuestionExtractor,
  FakeSecretCipher,
} from '@thp/testing';
import {
  FinishClassroomConnect,
  JobHandlerRegistry,
  MakeTestDoc,
  PdfImportHandler,
  pdfImportJobKind,
  PostDocToClassroom,
  RequestDocImport,
  RequestQuizImport,
  RunNextJob,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const pdf = new TextEncoder().encode('%PDF test');
const labels = {
  name: 'Nombre',
  date: 'Fecha',
  answer: 'Respuesta',
  true: 'Cierto',
  false: 'Falso',
  points: '{points} pts',
};
const extracted: ExtractedTest = {
  instructions: null,
  questions: [
    {
      id: 'q1' as QuestionId,
      type: 'matching',
      prompt: 'Match each word.',
      points: 5,
      instructions: 'A. Matching Definitions',
      pairs: [
        { left: 'risks', right: 'the chance of something bad' },
        { left: 'capable', right: 'able to do something successfully' },
      ],
    },
    {
      id: 'q2' as QuestionId,
      type: 'fill_blank',
      prompt: 'I felt ___.',
      points: 1,
      instructions: null,
      acceptedAnswers: ['SECRET-ANSWER'],
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
  const read = async () => {
    await new RunNextJob({
      jobs: world.jobs,
      handlers: new JobHandlerRegistry([
        new PdfImportHandler({
          ...world,
          pdfText: new FakePdfTextExtractor([{ pdf, text: 'Test text', pageCount: 1 }]),
          questionExtractor: new FakeQuestionExtractor(ok(extracted)),
        }),
      ]),
    }).execute();
  };
  return { actor, all, classroom, drive, request, read };
}

describe('A test as a Google Doc students type in', () => {
  it('reads the PDF, makes a clean Doc without answers, and posts it so each student gets a copy', async () => {
    const world = makeWorld();
    const { actor, all, classroom, drive, request, read } = await teacher(world);

    const job = valueOf(await request());
    expect(job).toMatchObject({ kind: pdfImportJobKind, ownerId: actor.id });
    await read();

    const doc = valueOf(await new MakeTestDoc(all).execute({ actor, jobId: job.id, labels }));
    expect(doc).toEqual({ docId: 'doc-1', url: 'https://docs.test/doc-1/edit' });
    expect(drive.docs[0]?.name).toBe('Chapter 3 – Try It!');
    expect(drive.docs[0]?.html).toContain('<td>______ 1. risks</td>');
    expect(drive.docs[0]?.html).toContain('Nombre: ');
    expect(drive.docs[0]?.html).not.toContain('SECRET-ANSWER');

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

    expect(await new MakeTestDoc(all).execute({ actor, jobId: job.id, labels })).toEqual(notFound);
    await read();
    expect(
      await new MakeTestDoc(all).execute({ actor: colleagueOf(actor), jobId: job.id, labels }),
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
    expect(await new MakeTestDoc(all).execute({ actor, jobId: quiz.id, labels })).toEqual(notFound);
    expect(
      await new MakeTestDoc(all).execute({ actor, jobId: 'missing' as JobId, labels }),
    ).toEqual(notFound);
  });

  it('names the fix when Google refuses the Doc', async () => {
    const world = makeWorld();
    const { actor, all, request, read } = await teacher(
      world,
      new FakeGoogleDrive({ accessToken: 'classroom-access', failWith: 'api_disabled' }),
    );
    const job = valueOf(await request());
    await read();
    expect(await new MakeTestDoc(all).execute({ actor, jobId: job.id, labels })).toEqual({
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
});
