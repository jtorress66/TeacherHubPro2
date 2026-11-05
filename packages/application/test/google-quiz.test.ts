import { describe, expect, it } from 'vitest';
import {
  ok,
  type ExtractedTest,
  type GoogleQuizId,
  type QuestionId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import {
  aUser,
  FakeClassroom,
  FakeClassroomAuthorization,
  FakeGoogleForms,
  FakePdfTextExtractor,
  FakeQuestionExtractor,
  FakeSecretCipher,
} from '@thp/testing';
import {
  FindGoogleQuiz,
  FinishClassroomConnect,
  GetImportedTest,
  JobHandlerRegistry,
  ListGoogleQuizzes,
  MakeGoogleQuiz,
  PdfImportHandler,
  pdfImportJobKind,
  PostQuizToClassroom,
  RequestQuizImport,
  RunNextJob,
} from '../src/index.ts';
import { colleagueOf, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const labels = { true: 'Verdadero', false: 'Falso' };
const pdf = new TextEncoder().encode('%PDF quiz');
const redirectUri = 'https://app.test/api/classroom/callback';

const reviewed = [
  {
    id: 'q1' as QuestionId,
    type: 'multiple_choice' as const,
    prompt: 'Closest planet?',
    options: ['Mercury', 'Venus'],
    correctOption: 0,
    points: 2,
  },
];

const deps = (world: World, forms: FakeGoogleForms, classroom: FakeClassroom) => ({
  ...world,
  cipher: new FakeSecretCipher(),
  classroomAuth: new FakeClassroomAuthorization(),
  classroomCoursework: classroom,
  googleForms: forms,
});

/** A teacher with no class; connected to Google unless told otherwise. */
async function teacher(world: World, forms = new FakeGoogleForms(), connect = true) {
  const { user: actor } = await signedUp(world);
  const classroom = new FakeClassroom({
    accessToken: 'classroom-access',
    course: { id: 'course-1', name: 'Science 5', section: null },
    roster: [],
  });
  const all = deps(world, forms, classroom);
  if (connect) {
    valueOf(
      await new FinishClassroomConnect(all).execute({ actor, code: 'classroom-code', redirectUri }),
    );
  }
  return { actor, all, forms, classroom };
}

const quizInput = { title: 'Space quiz', instructions: null, questions: reviewed, labels };

describe('Reading a test PDF without a class', () => {
  it('reads the PDF as a job of the teacher, with no class, for review', async () => {
    const world = makeWorld();
    const { actor } = await teacher(world, undefined, false);
    const extracted: ExtractedTest = { instructions: null, questions: [] };
    const job = valueOf(
      await new RequestQuizImport(world).execute({ actor, title: ' Space quiz ', pdf }),
    );
    expect(job).toMatchObject({ kind: pdfImportJobKind, ownerId: actor.id });

    await new RunNextJob({
      jobs: world.jobs,
      handlers: new JobHandlerRegistry([
        new PdfImportHandler({
          ...world,
          pdfText: new FakePdfTextExtractor([{ pdf, text: 'Quiz text', pageCount: 1 }]),
          questionExtractor: new FakeQuestionExtractor(ok(extracted)),
        }),
      ]),
    }).execute();

    expect(valueOf(await new GetImportedTest(world).execute({ actor, jobId: job.id }))).toEqual({
      test: extracted,
      classId: null,
      assignmentId: null,
      title: 'Space quiz',
    });
  });

  it('needs a title, a usable PDF and AI access', async () => {
    const world = makeWorld();
    const { actor } = await teacher(world, undefined, false);
    expect(await new RequestQuizImport(world).execute({ actor, title: ' ', pdf })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(
      await new RequestQuizImport(world).execute({ actor, title: 'Quiz', pdf: new Uint8Array() }),
    ).toEqual({ ok: false, error: { field: 'pdf', code: 'too_large' } });
    advanceDays(world, 8);
    expect(await new RequestQuizImport(world).execute({ actor, title: 'Quiz', pdf })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });
});

describe('Google Forms quiz without a class', () => {
  it('makes a quiz from the reviewed questions and keeps only its links', async () => {
    const world = makeWorld();
    const { actor, all, forms } = await teacher(world);

    const quiz = valueOf(
      await new MakeGoogleQuiz(all).execute({ actor, ...quizInput, instructions: 'Choose one.' }),
    );

    expect(forms.quizzes[0]).toMatchObject({ title: 'Space quiz', description: 'Choose one.' });
    expect(quiz).toMatchObject({
      schoolId: actor.schoolId,
      ownerId: actor.id,
      title: 'Space quiz',
      editUrl: 'https://forms.test/form-1/edit',
      responderUrl: 'https://forms.test/form-1/viewform',
      createdAt: world.clock.now(),
    });
    expect(valueOf(await new FindGoogleQuiz(all).execute({ actor, quizId: quiz.id }))).toEqual(
      quiz,
    );
    expect(valueOf(await new ListGoogleQuizzes(all).execute({ actor }))).toEqual([quiz]);
  });

  it('checks the questions and the title before calling Google', async () => {
    const world = makeWorld();
    const { actor, all, forms } = await teacher(world);
    const make = (changes: Partial<typeof quizInput>) =>
      new MakeGoogleQuiz(all).execute({ actor, ...quizInput, ...changes });

    expect(await make({ questions: [] })).toEqual({
      ok: false,
      error: { code: 'not_shareable' },
    });
    expect(await make({ questions: [{ ...reviewed[0], options: ['only one'] }] as never })).toEqual(
      { ok: false, error: { field: 'questions.0.options', code: 'required' } },
    );
    expect(await make({ title: ' ' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(forms.quizzes).toEqual([]);
  });

  it('needs a Google connection', async () => {
    const world = makeWorld();
    const { actor, all } = await teacher(world, undefined, false);
    expect(await new MakeGoogleQuiz(all).execute({ actor, ...quizInput })).toEqual({
      ok: false,
      error: { code: 'classroom_not_connected' },
    });
  });

  it('asks a teacher connected before Forms access to reconnect', async () => {
    const world = makeWorld();
    const forms = new FakeGoogleForms({ accessToken: 'newer', withoutScope: 'classroom-access' });
    const { actor, all } = await teacher(world, forms);
    expect(await new MakeGoogleQuiz(all).execute({ actor, ...quizInput })).toEqual({
      ok: false,
      error: { code: 'google_reconnect' },
    });
  });

  it('keeps nothing when Google fails', async () => {
    const world = makeWorld();
    const { actor, all } = await teacher(world, new FakeGoogleForms({ accessToken: 'other' }));
    expect(await new MakeGoogleQuiz(all).execute({ actor, ...quizInput })).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
    expect(valueOf(await new ListGoogleQuizzes(all).execute({ actor }))).toEqual([]);
  });

  it('posts the quiz to a Classroom course with its student link', async () => {
    const world = makeWorld();
    const { actor, all, classroom } = await teacher(world);
    const quiz = valueOf(await new MakeGoogleQuiz(all).execute({ actor, ...quizInput }));
    const post = (courseId: string, dueDate: string | null) =>
      new PostQuizToClassroom(all).execute({ actor, quizId: quiz.id, courseId, dueDate });

    expect(valueOf(await post('course-1', '2026-09-30')).url).toContain('classroom.test');
    expect(classroom.coursework.at(-1)).toEqual({
      title: 'Space quiz',
      description: '',
      material: { kind: 'link', url: quiz.responderUrl },
      dueDate: '2026-09-30',
    });
    expect(await post('nope', null)).toEqual({ ok: false, error: { code: 'classroom_failed' } });
    expect(await post('course-1', '30/09/2026')).toEqual({
      ok: false,
      error: { field: 'dueDate', code: 'invalid_format' },
    });
  });

  it("keeps each teacher's quizzes to themselves", async () => {
    const world = makeWorld();
    const { actor, all } = await teacher(world);
    const quiz = valueOf(await new MakeGoogleQuiz(all).execute({ actor, ...quizInput }));
    for (const someone of [colleagueOf(actor), outsider]) {
      expect(await new FindGoogleQuiz(all).execute({ actor: someone, quizId: quiz.id })).toEqual(
        notFound,
      );
      expect(
        await new PostQuizToClassroom(all).execute({
          actor: someone,
          quizId: quiz.id,
          courseId: 'course-1',
          dueDate: null,
        }),
      ).toEqual(notFound);
      expect(valueOf(await new ListGoogleQuizzes(all).execute({ actor: someone }))).toEqual([]);
    }
    expect(
      await new FindGoogleQuiz(all).execute({ actor, quizId: 'missing' as GoogleQuizId }),
    ).toEqual(notFound);
  });
});
