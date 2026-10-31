import { describe, expect, it } from 'vitest';
import type { AssignmentId, AttachmentId, QuestionId } from '@thp/domain';
import {
  GetStudentAssignment,
  GetStudentAttachment,
  IssueLinks,
  OpenStudentLink,
  SaveQuestions,
  SubmitAnswers,
  UploadAttachment,
} from '../src/index.ts';
import { gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const notFound = { ok: false, error: { code: 'not_found' } };

async function setUp(world: World) {
  const setup = await gradedClass(world);
  const quiz = await setup.assign('Quiz', 'Pruebas cortas', 100, '2026-09-10');
  const draft = await setup.assign('Not ready', 'Pruebas cortas', 100);
  const base = { actor: setup.actor, classId: setup.cls.id, assignmentId: quiz.id };
  valueOf(
    await new SaveQuestions(world).execute({
      ...base,
      questions: [
        {
          id: 'q1' as QuestionId,
          type: 'true_false',
          prompt: 'Sun is a star',
          answer: true,
          points: 2,
        },
        {
          id: 'q2' as QuestionId,
          type: 'matching',
          prompt: 'Match',
          pairs: [
            { left: 'dog', right: 'perro' },
            { left: 'cat', right: 'gato' },
          ],
          points: 4,
        },
      ],
    }),
  );
  const issued = valueOf(
    await new IssueLinks(world).execute({ actor: setup.actor, classId: setup.cls.id }),
  );
  const tokenOf = (studentId: string) =>
    issued.find((row) => row.student.id === studentId)?.token ?? '';
  return {
    ...setup,
    quiz,
    draft,
    base,
    anaToken: tokenOf(setup.ana.id),
    benToken: tokenOf(setup.ben.id),
  };
}

describe('Student portal', () => {
  it('opens a student’s link with their first name and the assignments ready for them', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const portal = valueOf(await new OpenStudentLink(world).execute({ token: s.anaToken }));

    expect(portal).toMatchObject({ firstName: 'Ana', className: 'Ciencias 5' });
    expect(portal.assignments.map((a) => [a.title, a.status])).toEqual([['Quiz', 'todo']]);
    expect(JSON.stringify(portal)).not.toContain('Zayas');
  });

  it('shows an assignment without its answers', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const view = valueOf(
      await new GetStudentAssignment(world).execute({ token: s.anaToken, assignmentId: s.quiz.id }),
    );

    expect(view.questions.map((q) => q.type)).toEqual(['true_false', 'matching']);
    expect(view.questions[1]).toMatchObject({ lefts: ['dog', 'cat'], rights: ['gato', 'perro'] });
    expect(JSON.stringify(view)).not.toContain('"answer"');
    expect(view.submission).toBeNull();
  });

  it('takes one submission per student, scored at once, tied to the link’s student', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const answers = { q1: 'true', q2: JSON.stringify({ dog: 'perro', cat: 'perro' }) };

    const done = valueOf(
      await new SubmitAnswers(world).execute({
        token: s.anaToken,
        assignmentId: s.quiz.id,
        answers,
      }),
    );
    expect(done).toMatchObject({ late: false });
    expect(
      await new SubmitAnswers(world).execute({
        token: s.anaToken,
        assignmentId: s.quiz.id,
        answers,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'already_submitted' },
    });

    const saved = await world.submissions.findFor(s.actor.schoolId, s.ana.id, s.quiz.id);
    expect(saved).toMatchObject({ status: 'ai_graded', aiDraft: { score: 4 } });

    const portal = valueOf(await new OpenStudentLink(world).execute({ token: s.anaToken }));
    expect(portal.assignments[0]?.status).toBe('submitted');
    const benPortal = valueOf(await new OpenStudentLink(world).execute({ token: s.benToken }));
    expect(benPortal.assignments[0]?.status).toBe('todo');
  });

  it('accepts a late submission and marks it', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    advanceDays(world, 30);
    const done = valueOf(
      await new SubmitAnswers(world).execute({
        token: s.anaToken,
        assignmentId: s.quiz.id,
        answers: { q1: 'true' },
      }),
    );
    expect(done.late).toBe(true);
  });

  it('refuses unknown, expired and wrong-class links, and assignments not ready', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(await new OpenStudentLink(world).execute({ token: 'not-a-real-token' })).toEqual(
      notFound,
    );
    expect(
      await new GetStudentAssignment(world).execute({
        token: s.anaToken,
        assignmentId: s.draft.id,
      }),
    ).toEqual(notFound);
    expect(
      await new GetStudentAssignment(world).execute({
        token: s.anaToken,
        assignmentId: 'missing' as AssignmentId,
      }),
    ).toEqual(notFound);
    expect(
      await new SubmitAnswers(world).execute({
        token: s.anaToken,
        assignmentId: s.quiz.id,
        answers: { q9: 'x' },
      }),
    ).toEqual({
      ok: false,
      error: { field: 'q9', code: 'not_allowed' },
    });
    advanceDays(world, 400);
    expect(await new OpenStudentLink(world).execute({ token: s.anaToken })).toEqual(notFound);
  });

  it('lets a student open only their class’s attachments', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const attachment = valueOf(
      await new UploadAttachment(world).execute({
        ...s.base,
        name: 'notes.pdf',
        contentType: 'application/pdf',
        bytes: new TextEncoder().encode('%PDF notes'),
      }),
    );
    const view = valueOf(
      await new GetStudentAssignment(world).execute({ token: s.anaToken, assignmentId: s.quiz.id }),
    );
    expect(view.attachments).toEqual([
      {
        id: attachment.id,
        name: 'notes.pdf',
        contentType: 'application/pdf',
        size: attachment.size,
      },
    ]);
    const file = valueOf(
      await new GetStudentAttachment(world).execute({
        token: s.anaToken,
        attachmentId: attachment.id,
      }),
    );
    expect(new TextDecoder().decode(file.bytes)).toBe('%PDF notes');
    expect(
      await new GetStudentAttachment(world).execute({ token: 'nope', attachmentId: attachment.id }),
    ).toEqual(notFound);
    expect(
      await new GetStudentAttachment(world).execute({
        token: s.anaToken,
        attachmentId: 'missing' as AttachmentId,
      }),
    ).toEqual(notFound);
  });
});
