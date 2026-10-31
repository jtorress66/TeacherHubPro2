import { describe, expect, it } from 'vitest';
import {
  ok,
  type AttachmentId,
  type ExtractedTest,
  type QuestionId,
  type SchoolId,
  type StudentLinkId,
  type SubmissionId,
  type UserId,
} from '@thp/domain';
import {
  aUser,
  FakeClassroom,
  FakeClassroomAuthorization,
  FakePdfTextExtractor,
  FakeQuestionExtractor,
  FakeSecretCipher,
  FakeSubmissionGrader,
} from '@thp/testing';
import {
  ConfirmGrade,
  DeleteAttachment,
  DisconnectClassroom,
  FinishClassroomConnect,
  GetGradebook,
  GetImportedTest,
  GradeByHand,
  GradingHandler,
  ImportClassroomRoster,
  IssueLinks,
  JobHandlerRegistry,
  ListAttachments,
  ListClassroomCourses,
  ListLinks,
  ListSubmissions,
  PdfImportHandler,
  ReissueLink,
  RequestAiGrading,
  RequestPdfImport,
  RevokeLink,
  RunNextJob,
  SaveInstructions,
  SaveQuestions,
  ShareAssignment,
  StartClassroomConnect,
  SubmitAnswers,
  UploadAttachment,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };

const questions = [
  {
    id: 'q1' as QuestionId,
    type: 'multiple_choice' as const,
    prompt: 'Closest planet?',
    options: ['Mercury', 'Venus'],
    correctOption: 0,
    points: 4,
  },
  {
    id: 'q2' as QuestionId,
    type: 'short_answer' as const,
    prompt: 'Why day and night?',
    points: 6,
  },
];

/** A class with three students and an assignment with an objective and an open question. */
async function classWithQuiz(world: World) {
  const setup = await gradedClass(world);
  const assignment = await setup.assign('Space quiz', 'Pruebas cortas', 100, '2026-09-30');
  const base = { actor: setup.actor, classId: setup.cls.id, assignmentId: assignment.id };
  valueOf(await new SaveQuestions(world).execute({ ...base, questions }));
  return { ...setup, assignment, base };
}

async function runJobs(
  world: World,
  ...handlers: ConstructorParameters<typeof JobHandlerRegistry>[0]
) {
  const run = new RunNextJob({ jobs: world.jobs, handlers: new JobHandlerRegistry(handlers) });
  while ((await run.execute()) !== 'idle') {
    // until the queue is empty
  }
}

const link = async (
  world: World,
  setup: Awaited<ReturnType<typeof classWithQuiz>>,
  student = setup.ana,
) => {
  const issued = valueOf(
    await new IssueLinks(world).execute({ actor: setup.actor, classId: setup.cls.id }),
  );
  const found = issued.find((row) => row.student.id === student.id);
  if (found === undefined) throw new Error('no link');
  return found.token;
};

describe('Question builder', () => {
  it('saves questions and general instructions for the class’s teacher', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    const saved = valueOf(
      await new SaveInstructions(world).execute({ ...base, instructions: 'Use a pencil.' }),
    );
    expect(saved.instructions).toBe('Use a pencil.');
    expect(saved.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('names the question and field that break a rule', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    expect(
      await new SaveQuestions(world).execute({
        ...base,
        questions: [
          {
            id: 'q1' as QuestionId,
            type: 'multiple_choice',
            prompt: 'Pick',
            options: ['a'],
            correctOption: 0,
          },
        ],
      }),
    ).toEqual({ ok: false, error: { field: 'questions.0.options', code: 'required' } });
  });

  it('keeps questions fixed once students have submitted', async () => {
    const world = makeWorld();
    const setup = await classWithQuiz(world);
    const token = await link(world, setup);
    valueOf(
      await new SubmitAnswers(world).execute({
        token,
        assignmentId: setup.assignment.id,
        answers: { q1: '0' },
      }),
    );
    expect(await new SaveQuestions(world).execute({ ...setup.base, questions })).toEqual({
      ok: false,
      error: { code: 'has_submissions' },
    });
  });

  it('refuses another school and a teacher who does not manage the class', async () => {
    const world = makeWorld();
    const { base, actor } = await classWithQuiz(world);
    expect(await new SaveQuestions(world).execute({ ...base, actor: outsider, questions })).toEqual(
      notFound,
    );
    expect(
      await new SaveQuestions(world).execute({ ...base, actor: colleagueOf(actor), questions }),
    ).toEqual(forbidden);
  });
});

describe('Attachments', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4 worksheet');
  const upload = (
    world: World,
    base: Awaited<ReturnType<typeof classWithQuiz>>['base'],
    name = 'sheet.pdf',
  ) =>
    new UploadAttachment(world).execute({
      ...base,
      name,
      contentType: 'application/pdf',
      bytes: pdf,
    });

  it('stores the file, lists it, and deletes it with its bytes', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    const attachment = valueOf(await upload(world, base));

    expect(valueOf(await new ListAttachments(world).execute(base))).toEqual([attachment]);
    expect((await world.files.get(attachment.key)).ok).toBe(true);

    valueOf(await new DeleteAttachment(world).execute({ ...base, attachmentId: attachment.id }));
    expect(valueOf(await new ListAttachments(world).execute(base))).toEqual([]);
    expect((await world.files.get(attachment.key)).ok).toBe(false);
  });

  it('refuses a disallowed type and more than ten files', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    expect(
      await new UploadAttachment(world).execute({
        ...base,
        name: 'x.exe',
        contentType: 'application/x-msdownload',
        bytes: pdf,
      }),
    ).toEqual({ ok: false, error: { field: 'contentType', code: 'not_allowed' } });
    for (let i = 0; i < 10; i++) valueOf(await upload(world, base, `f${String(i)}.pdf`));
    expect(await upload(world, base)).toEqual({
      ok: false,
      error: { code: 'too_many_attachments' },
    });
  });

  it('keeps another school out', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    const attachment = valueOf(await upload(world, base));
    expect(
      await new DeleteAttachment(world).execute({
        ...base,
        actor: outsider,
        attachmentId: attachment.id,
      }),
    ).toEqual(notFound);
    expect(
      await new DeleteAttachment(world).execute({
        ...base,
        attachmentId: 'missing' as AttachmentId,
      }),
    ).toEqual(notFound);
  });
});

describe('PDF → online test', () => {
  const pdf = new TextEncoder().encode('%PDF quiz');
  const extracted: ExtractedTest = {
    instructions: 'Answer all.',
    questions: [
      {
        id: 'q1' as QuestionId,
        type: 'true_false',
        prompt: 'Sun is a star',
        points: 2,
        instructions: null,
        answer: true,
      },
    ],
  };
  const deps = (world: World, extractor = new FakeQuestionExtractor(ok(extracted))) => ({
    ...world,
    pdfText: new FakePdfTextExtractor([{ pdf, text: 'Quiz text', pageCount: 1 }]),
    questionExtractor: extractor,
  });

  it('reads the PDF as a job and offers its questions to the teacher only, without saving', async () => {
    const world = makeWorld();
    const { base, actor, assignment } = await classWithQuiz(world);
    const extractor = new FakeQuestionExtractor(ok(extracted));
    const job = valueOf(await new RequestPdfImport(world).execute({ ...base, pdf }));

    await runJobs(world, new PdfImportHandler(deps(world, extractor)));

    expect(extractor.inputs).toEqual([{ text: 'Quiz text', language: actor.language }]);
    expect(valueOf(await new GetImportedTest(world).execute({ actor, jobId: job.id }))).toEqual({
      test: extracted,
      classId: base.classId,
      assignmentId: assignment.id,
    });
    expect(
      await new GetImportedTest(world).execute({ actor: colleagueOf(actor), jobId: job.id }),
    ).toEqual(notFound);
    expect(
      (await world.assignments.findById(actor.schoolId, assignment.id))?.questions,
    ).toHaveLength(2);
  });

  it('fails the job clearly for a PDF without text or one it cannot read, and removes the file', async () => {
    const world = makeWorld();
    const { base, actor } = await classWithQuiz(world);
    const blank = new TextEncoder().encode('%PDF scanned');
    const job = valueOf(await new RequestPdfImport(world).execute({ ...base, pdf: blank }));
    const unreadable = valueOf(
      await new RequestPdfImport(world).execute({ ...base, pdf: new Uint8Array([1, 2]) }),
    );
    await runJobs(
      world,
      new PdfImportHandler({
        ...deps(world),
        pdfText: new FakePdfTextExtractor([{ pdf: blank, text: '  \n ', pageCount: 2 }]),
      }),
    );

    expect(await world.jobs.findForOwner(actor.schoolId, actor.id, job.id)).toMatchObject({
      status: 'failed',
      error: 'pdf_no_text',
    });
    expect(await world.jobs.findForOwner(actor.schoolId, actor.id, unreadable.id)).toMatchObject({
      error: 'pdf_unreadable',
    });
    const payload = job.payload as { fileKey: string };
    expect((await world.files.get(payload.fileKey)).ok).toBe(false);
  });

  it('needs AI access', async () => {
    const world = makeWorld();
    const { base } = await classWithQuiz(world);
    advanceDays(world, 8);
    expect(await new RequestPdfImport(world).execute({ ...base, pdf })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });
});

describe('Student links', () => {
  it('issues one link per student, shown once, and only for students without a working link', async () => {
    const world = makeWorld();
    const setup = await classWithQuiz(world);
    const input = { actor: setup.actor, classId: setup.cls.id };

    const first = valueOf(await new IssueLinks(world).execute(input));
    expect(first.map((row) => row.student.lastName).sort()).toEqual(['Acosta', 'Morales', 'Zayas']);
    expect(first.every((row) => row.token.length >= 32)).toBe(true);
    expect(valueOf(await new IssueLinks(world).execute(input))).toEqual([]);

    const listed = valueOf(await new ListLinks(world).execute(input));
    expect(listed.every((row) => row.usable)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(first[0]?.token ?? 'no-token');
  });

  it('revokes and reissues a student’s link', async () => {
    const world = makeWorld();
    const setup = await classWithQuiz(world);
    const input = { actor: setup.actor, classId: setup.cls.id };
    const token = await link(world, setup);
    const [row] = valueOf(await new ListLinks(world).execute(input)).filter(
      (r) => r.student.id === setup.ana.id,
    );
    if (row?.link === null || row === undefined) throw new Error('no link');

    valueOf(await new RevokeLink(world).execute({ ...input, linkId: row.link.id }));
    expect(
      await new SubmitAnswers(world).execute({
        token,
        assignmentId: setup.assignment.id,
        answers: {},
      }),
    ).toEqual(notFound);

    const reissued = valueOf(
      await new ReissueLink(world).execute({ ...input, studentId: setup.ana.id }),
    );
    expect(reissued.token).not.toBe(token);
    expect(
      await new RevokeLink(world).execute({ ...input, actor: outsider, linkId: row.link.id }),
    ).toEqual(notFound);
    expect(
      await new RevokeLink(world).execute({ ...input, linkId: 'missing' as StudentLinkId }),
    ).toEqual(notFound);
  });
});

describe('Grading', () => {
  async function submitted(world: World) {
    const setup = await classWithQuiz(world);
    const token = await link(world, setup);
    valueOf(
      await new SubmitAnswers(world).execute({
        token,
        assignmentId: setup.assignment.id,
        answers: { q1: '0', q2: 'Because the Earth spins' },
      }),
    );
    return setup;
  }

  it('lists every student with their submission and its code score', async () => {
    const world = makeWorld();
    const setup = await submitted(world);
    const list = valueOf(await new ListSubmissions(world).execute(setup.base));

    expect(list.rows.map((row) => [row.student.lastName, row.submission?.status ?? null])).toEqual([
      ['Acosta', null],
      ['Morales', null],
      ['Zayas', 'submitted'],
    ]);
    expect(list.rows[2]?.submission?.questionScores).toMatchObject({
      q1: { score: 4, source: 'auto' },
    });
  });

  it('asks the AI only about open answers, then the teacher confirms into the gradebook', async () => {
    const world = makeWorld();
    const setup = await submitted(world);
    const grader = new FakeSubmissionGrader(0.5);
    const job = valueOf(await new RequestAiGrading(world).execute(setup.base));
    expect(job).not.toBeNull();

    await runJobs(world, new GradingHandler({ ...world, grader }));

    expect(grader.requests).toHaveLength(1);
    expect(grader.requests[0]?.questions.map((q) => q.id)).toEqual(['q2']);
    expect(JSON.stringify(grader.requests)).not.toContain('Zayas');
    const [row] = valueOf(await new ListSubmissions(world).execute(setup.base)).rows.filter(
      (r) => r.submission !== null,
    );
    const submission = row?.submission;
    if (!submission) throw new Error('no submission');
    expect(submission).toMatchObject({ status: 'ai_graded', aiDraft: { score: 7 } });

    const before = valueOf(
      await new GetGradebook(world).execute({ actor: setup.actor, classId: setup.cls.id }),
    );
    expect(JSON.stringify(before)).not.toContain('confirmed_ai');

    const confirmed = valueOf(
      await new ConfirmGrade(world).execute({
        ...setup.base,
        submissionId: submission.id,
        score: 8,
      }),
    );
    expect(confirmed).toMatchObject({ status: 'confirmed', finalScore: 8 });
    const grade = await world.grades.findFor(
      setup.actor.schoolId,
      setup.ana.id,
      setup.assignment.id,
    );
    expect(grade).toMatchObject({ score: 8, source: 'confirmed_ai', gradedBy: setup.actor.id });
  });

  it('has nothing to grade when no open answers wait', async () => {
    const world = makeWorld();
    const setup = await classWithQuiz(world);
    expect(await new RequestAiGrading(world).execute(setup.base)).toEqual({
      ok: true,
      value: null,
    });
  });

  it('keeps a submission gradeable by hand when the AI fails', async () => {
    const world = makeWorld();
    const setup = await submitted(world);
    valueOf(await new RequestAiGrading(world).execute(setup.base));
    await runJobs(
      world,
      new GradingHandler({ ...world, grader: new FakeSubmissionGrader('ai_unavailable') }),
    );
    const [row] = valueOf(await new ListSubmissions(world).execute(setup.base)).rows.filter(
      (r) => r.submission !== null,
    );
    const submission = row?.submission;
    if (!submission) throw new Error('no submission');
    expect(submission).toMatchObject({ status: 'submitted', aiFailure: 'ai_unavailable' });

    const graded = valueOf(
      await new GradeByHand(world).execute({
        ...setup.base,
        submissionId: submission.id,
        score: 9,
        comment: 'Good',
      }),
    );
    expect(graded.finalScore).toBe(9);
    expect(
      await world.grades.findFor(setup.actor.schoolId, setup.ana.id, setup.assignment.id),
    ).toMatchObject({
      source: 'manual',
      comment: 'Good',
    });
  });

  it('refuses to confirm without a draft, and keeps others out', async () => {
    const world = makeWorld();
    const setup = await submitted(world);
    const [row] = valueOf(await new ListSubmissions(world).execute(setup.base)).rows.filter(
      (r) => r.submission !== null,
    );
    const submissionId = row?.submission?.id ?? ('none' as SubmissionId);

    expect((await new ConfirmGrade(world).execute({ ...setup.base, submissionId })).ok).toBe(false);
    expect(await new ListSubmissions(world).execute({ ...setup.base, actor: outsider })).toEqual(
      notFound,
    );
    expect(
      await new GradeByHand(world).execute({
        ...setup.base,
        actor: colleagueOf(setup.actor),
        submissionId,
        score: 1,
      }),
    ).toEqual(forbidden);
    expect(
      await new GradeByHand(world).execute({
        ...setup.base,
        submissionId: 'missing' as SubmissionId,
        score: 1,
      }),
    ).toEqual(notFound);
  });
});

describe('Google Classroom', () => {
  const classroom = new FakeClassroom({
    accessToken: 'classroom-access',
    course: { id: 'course-1', name: 'Science 5', section: 'A' },
    roster: [
      { firstName: 'Ana', lastName: 'Zayas' },
      { firstName: 'Diego', lastName: 'Ruiz' },
    ],
  });
  const deps = (world: World) => ({
    ...world,
    cipher: new FakeSecretCipher(),
    classroomAuth: new FakeClassroomAuthorization(),
    classroomCourses: classroom,
    classroomCoursework: classroom,
  });
  const redirectUri = 'https://app.test/api/classroom/callback';

  async function connected(world: World) {
    const setup = await classWithQuiz(world);
    const all = deps(world);
    valueOf(
      await new FinishClassroomConnect(all).execute({
        actor: setup.actor,
        code: 'classroom-code',
        redirectUri,
      }),
    );
    return { setup, all };
  }

  it('connects with an encrypted token and lists courses', async () => {
    const world = makeWorld();
    const { setup, all } = await connected(world);
    expect(new StartClassroomConnect(all).execute({ state: 's-1', redirectUri })).toContain(
      'state=s-1',
    );
    const stored = await world.classroomConnections.find(setup.actor.schoolId, setup.actor.id);
    expect(stored?.encryptedRefreshToken).not.toContain('refresh-for');
    expect(valueOf(await new ListClassroomCourses(all).execute({ actor: setup.actor }))).toEqual([
      { id: 'course-1', name: 'Science 5', section: 'A' },
    ]);
  });

  it('imports the roster into a class, skipping students already there', async () => {
    const world = makeWorld();
    const { setup, all } = await connected(world);
    expect(
      valueOf(
        await new ImportClassroomRoster(all).execute({
          actor: setup.actor,
          classId: setup.cls.id,
          courseId: 'course-1',
        }),
      ),
    ).toEqual({ added: 1, skipped: 1 });
  });

  it('shares an assignment that has questions, with no personal links in it', async () => {
    const world = makeWorld();
    const { setup, all } = await connected(world);
    const shared = valueOf(
      await new ShareAssignment(all).execute({ ...setup.base, courseId: 'course-1' }),
    );
    expect(shared.url).toContain('classroom.test');
    expect(classroom.coursework.at(-1)).toMatchObject({
      title: 'Space quiz',
      dueDate: '2026-09-30',
    });

    const empty = await setup.assign('Empty', 'Pruebas cortas', 10);
    expect(
      await new ShareAssignment(all).execute({
        ...setup.base,
        assignmentId: empty.id,
        courseId: 'course-1',
      }),
    ).toEqual({ ok: false, error: { code: 'not_shareable' } });
  });

  it('needs a connection, refuses a bad code, and disconnects', async () => {
    const world = makeWorld();
    const setup = await classWithQuiz(world);
    const all = deps(world);
    expect(await new ListClassroomCourses(all).execute({ actor: setup.actor })).toEqual({
      ok: false,
      error: { code: 'classroom_not_connected' },
    });
    expect(
      await new FinishClassroomConnect(all).execute({
        actor: setup.actor,
        code: 'bad',
        redirectUri,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'classroom_failed' },
    });
    valueOf(
      await new FinishClassroomConnect(all).execute({
        actor: setup.actor,
        code: 'classroom-code',
        redirectUri,
      }),
    );
    valueOf(await new DisconnectClassroom(all).execute({ actor: setup.actor }));
    expect(await world.classroomConnections.find(setup.actor.schoolId, setup.actor.id)).toBeNull();
  });
});
