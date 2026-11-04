import { describe, expect, it } from 'vitest';
import { maxAttachmentBytes, type SchoolId, type UserId } from '@thp/domain';
import { aUser, FakeClassroomAuthorization, FakeGoogleForms, FakeSecretCipher } from '@thp/testing';
import {
  FindFormsQuiz,
  FinishClassroomConnect,
  MakeFormsQuiz,
  pdfImportJobKind,
  SaveQuestions,
  StartPdfTest,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const labels = { true: 'Verdadero', false: 'Falso' };
const pdf = new TextEncoder().encode('%PDF quiz');

describe('Start a test from a PDF', () => {
  async function details(world: World) {
    const setup = await gradedClass(world);
    return {
      setup,
      input: {
        actor: setup.actor,
        classId: setup.cls.id,
        details: {
          title: 'Fractions quiz',
          categoryId: setup.category('Pruebas cortas'),
          points: 50,
          dueDate: '2026-09-30',
        },
        pdf,
      },
    };
  }

  it('creates the assignment and queues reading the PDF into it', async () => {
    const world = makeWorld();
    const { setup, input } = await details(world);

    const started = valueOf(await new StartPdfTest(world).execute(input));

    expect(started.assignment).toMatchObject({
      title: 'Fractions quiz',
      classId: setup.cls.id,
      points: 50,
      dueDate: '2026-09-30',
      questions: [],
    });
    expect(started.job).toMatchObject({
      kind: pdfImportJobKind,
      ownerId: setup.actor.id,
      payload: { classId: setup.cls.id, assignmentId: started.assignment.id },
    });
  });

  it('leaves nothing behind when the PDF is refused', async () => {
    const world = makeWorld();
    const { setup, input } = await details(world);

    expect(await new StartPdfTest(world).execute({ ...input, pdf: new Uint8Array() })).toEqual({
      ok: false,
      error: { field: 'pdf', code: 'too_large' },
    });
    expect(
      await new StartPdfTest(world).execute({
        ...input,
        pdf: new Uint8Array(maxAttachmentBytes + 1),
      }),
    ).toEqual({ ok: false, error: { field: 'pdf', code: 'too_large' } });
    expect(await world.assignments.listByClass(setup.actor.schoolId, setup.cls.id)).toEqual([]);
  });

  it('checks the assignment details', async () => {
    const world = makeWorld();
    const { input } = await details(world);
    expect(
      await new StartPdfTest(world).execute({
        ...input,
        details: { ...input.details, title: ' ' },
      }),
    ).toEqual({ ok: false, error: { field: 'title', code: 'required' } });
  });

  it('needs AI access, and creates nothing without it', async () => {
    const world = makeWorld();
    const { setup, input } = await details(world);
    advanceDays(world, 8);
    expect(await new StartPdfTest(world).execute(input)).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
    expect(await world.assignments.listByClass(setup.actor.schoolId, setup.cls.id)).toEqual([]);
  });

  it("cannot reach another school's class", async () => {
    const world = makeWorld();
    const { input } = await details(world);
    expect(await new StartPdfTest(world).execute({ ...input, actor: outsider })).toEqual(notFound);
  });
});

describe('Google Forms quiz', () => {
  const redirectUri = 'https://app.test/api/classroom/callback';
  const deps = (world: World, forms = new FakeGoogleForms()) => ({
    ...world,
    cipher: new FakeSecretCipher(),
    classroomAuth: new FakeClassroomAuthorization(),
    googleForms: forms,
  });

  async function quizClass(world: World, forms?: FakeGoogleForms, connect = true) {
    const setup = await gradedClass(world);
    const assignment = await setup.assign('Space quiz', 'Pruebas cortas', 10);
    const ref = { actor: setup.actor, classId: setup.cls.id, assignmentId: assignment.id };
    valueOf(
      await new SaveQuestions(world).execute({
        ...ref,
        questions: [
          {
            id: 'q1' as never,
            type: 'true_false',
            prompt: 'The Sun is a star',
            answer: true,
            points: 4,
          },
        ],
      }),
    );
    const all = deps(world, forms);
    if (connect) {
      valueOf(
        await new FinishClassroomConnect(all).execute({
          actor: setup.actor,
          code: 'classroom-code',
          redirectUri,
        }),
      );
    }
    return { setup, ref, all, assignment };
  }

  it('makes a quiz from the questions, with labels in the teacher language, and keeps its links', async () => {
    const world = makeWorld();
    const forms = new FakeGoogleForms();
    const { ref, all } = await quizClass(world, forms);

    const made = valueOf(await new MakeFormsQuiz(all).execute({ ...ref, labels }));

    expect(forms.quizzes).toEqual([
      {
        title: 'Space quiz',
        description: '',
        items: [
          {
            kind: 'choice',
            title: 'The Sun is a star',
            description: null,
            points: 4,
            options: ['Verdadero', 'Falso'],
            correct: ['Verdadero'],
          },
        ],
      },
    ]);
    expect(made).toEqual({
      schoolId: ref.actor.schoolId,
      assignmentId: ref.assignmentId,
      formId: 'form-1',
      editUrl: 'https://forms.test/form-1/edit',
      responderUrl: 'https://forms.test/form-1/viewform',
      createdAt: world.clock.now(),
    });
    expect(valueOf(await new FindFormsQuiz(all).execute(ref))).toEqual(made);
  });

  it('replaces the kept quiz when the teacher makes another', async () => {
    const world = makeWorld();
    const { ref, all } = await quizClass(world);
    await new MakeFormsQuiz(all).execute({ ...ref, labels });
    await new MakeFormsQuiz(all).execute({ ...ref, labels });
    expect(valueOf(await new FindFormsQuiz(all).execute(ref))?.formId).toBe('form-2');
  });

  it('has nothing to show before a quiz is made', async () => {
    const world = makeWorld();
    const { ref, all } = await quizClass(world);
    expect(await new FindFormsQuiz(all).execute(ref)).toEqual({ ok: true, value: null });
  });

  it('needs questions and a Google connection', async () => {
    const world = makeWorld();
    const { setup, all } = await quizClass(world, undefined, false);
    const ref = { actor: setup.actor, classId: setup.cls.id };
    const empty = await setup.assign('Empty', 'Pruebas cortas', 10);
    expect(
      await new MakeFormsQuiz(all).execute({ ...ref, assignmentId: empty.id, labels }),
    ).toEqual({ ok: false, error: { code: 'not_shareable' } });
    const quiz = (await world.assignments.listByClass(setup.actor.schoolId, setup.cls.id))[0];
    expect(
      await new MakeFormsQuiz(all).execute({ ...ref, assignmentId: quiz?.id as never, labels }),
    ).toEqual({ ok: false, error: { code: 'classroom_not_connected' } });
  });

  it('asks a teacher connected before Forms access to reconnect', async () => {
    const world = makeWorld();
    const forms = new FakeGoogleForms({ accessToken: 'newer', withoutScope: 'classroom-access' });
    const { ref, all } = await quizClass(world, forms);
    expect(await new MakeFormsQuiz(all).execute({ ...ref, labels })).toEqual({
      ok: false,
      error: { code: 'google_reconnect' },
    });
  });

  it('reports any other Google failure without keeping a quiz', async () => {
    const world = makeWorld();
    const forms = new FakeGoogleForms({ accessToken: 'someone-else' });
    const { ref, all } = await quizClass(world, forms);
    expect(await new MakeFormsQuiz(all).execute({ ...ref, labels })).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
    expect(valueOf(await new FindFormsQuiz(all).execute(ref))).toBeNull();
  });

  it("cannot reach another school's or a colleague's assignment", async () => {
    const world = makeWorld();
    const { ref, all } = await quizClass(world);
    valueOf(await new MakeFormsQuiz(all).execute({ ...ref, labels }));
    expect(await new MakeFormsQuiz(all).execute({ ...ref, actor: outsider, labels })).toEqual(
      notFound,
    );
    expect(await new FindFormsQuiz(all).execute({ ...ref, actor: outsider })).toEqual(notFound);
    const colleague = colleagueOf(ref.actor);
    expect((await new MakeFormsQuiz(all).execute({ ...ref, actor: colleague, labels })).ok).toBe(
      false,
    );
    expect((await new FindFormsQuiz(all).execute({ ...ref, actor: colleague })).ok).toBe(false);
  });
});
