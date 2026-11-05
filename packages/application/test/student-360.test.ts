import { describe, expect, it } from 'vitest';
import type { SchoolId, StudentId, StudentNoteId, UserId } from '@thp/domain';
import { aUser, FakeInsightWriter } from '@thp/testing';
import {
  AddStudentNote,
  DeleteStudentNote,
  GetStudent360,
  JobHandlerRegistry,
  RequestStudentInsight,
  RunNextJob,
  StudentInsightHandler,
  studentInsightJobKind,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, type World } from './world.ts';

const timeZone = 'America/Puerto_Rico';
const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
const notFound = { ok: false, error: { code: 'not_found' } };

async function anaWithWork(world: World) {
  const setup = await gradedClass(world);
  const quiz = await setup.assign('Fractions quiz', 'Pruebas cortas', 10, '2026-08-25');
  await setup.assign('Essay', 'Pruebas cortas', 20, '2026-08-28');
  await setup.grade(quiz.id, [{ studentId: setup.ana.id, status: 'graded', score: 4 }]);
  const ref = { actor: setup.actor, classId: setup.cls.id, studentId: setup.ana.id };
  return { ...setup, quiz, ref };
}

describe('GetStudent360', () => {
  it("shows one student's stats, missing work, timeline and the viewer's notes", async () => {
    const world = makeWorld();
    const { ref, ana, cls } = await anaWithWork(world);
    valueOf(await new AddStudentNote(world).execute({ ...ref, text: 'Seems tired this week.' }));

    const view = valueOf(await new GetStudent360(world).execute({ ...ref, timeZone }));

    expect(view.student).toEqual(ana);
    expect(view.cls.id).toBe(cls.id);
    expect(view.summary.stats).toMatchObject({ average: 40, missing: 1 });
    expect(view.summary.missing.map((a) => a.title)).toEqual(['Essay']);
    expect(view.notes.map((n) => n.text)).toEqual(['Seems tired this week.']);
    expect(view.summary.timeline[0]).toMatchObject({
      kind: 'note',
      text: 'Seems tired this week.',
    });
    expect(view.insight).toBeNull();
  });

  it("refuses another school, a colleague's class and a student of another class", async () => {
    const world = makeWorld();
    const { ref } = await anaWithWork(world);
    expect(await new GetStudent360(world).execute({ ...ref, actor: outsider, timeZone })).toEqual(
      notFound,
    );
    expect(
      (await new GetStudent360(world).execute({ ...ref, actor: colleagueOf(ref.actor), timeZone }))
        .ok,
    ).toBe(false);
    expect(
      await new GetStudent360(world).execute({
        ...ref,
        studentId: 'someone-else' as StudentId,
        timeZone,
      }),
    ).toEqual(notFound);
  });
});

describe('Student notes', () => {
  it('keeps notes private to their author, who alone can delete them', async () => {
    const world = makeWorld();
    const { ref } = await anaWithWork(world);
    const note = valueOf(await new AddStudentNote(world).execute({ ...ref, text: ' Call home. ' }));
    expect(note.text).toBe('Call home.');

    const admin = colleagueOf(ref.actor, 'school_admin');
    const asAdmin = valueOf(
      await new GetStudent360(world).execute({ ...ref, actor: admin, timeZone }),
    );
    expect(asAdmin.notes).toEqual([]);
    expect(
      await new DeleteStudentNote(world).execute({ ...ref, actor: admin, noteId: note.id }),
    ).toEqual(notFound);

    valueOf(await new DeleteStudentNote(world).execute({ ...ref, noteId: note.id }));
    expect(await new DeleteStudentNote(world).execute({ ...ref, noteId: note.id })).toEqual(
      notFound,
    );
    expect(
      await new DeleteStudentNote(world).execute({ ...ref, noteId: 'nope' as StudentNoteId }),
    ).toEqual(notFound);
  });

  it('refuses a blank note and a class the actor cannot manage', async () => {
    const world = makeWorld();
    const { ref } = await anaWithWork(world);
    expect(await new AddStudentNote(world).execute({ ...ref, text: ' ' })).toEqual({
      ok: false,
      error: { field: 'text', code: 'required' },
    });
    expect(await new AddStudentNote(world).execute({ ...ref, actor: outsider, text: 'x' })).toEqual(
      notFound,
    );
  });
});

describe('Student insight', () => {
  async function runInsightJob(world: World, writer = new FakeInsightWriter()) {
    const run = new RunNextJob({
      jobs: world.jobs,
      handlers: new JobHandlerRegistry([
        new StudentInsightHandler({ ...world, insightWriter: writer }),
      ]),
    });
    await run.execute();
    return writer;
  }

  it('drafts an insight from numbers only, and keeps it for the teacher', async () => {
    const world = makeWorld();
    const { ref, ana } = await anaWithWork(world);
    valueOf(
      await new AddStudentNote(world).execute({ ...ref, text: 'Private: parents divorcing.' }),
    );

    const job = valueOf(await new RequestStudentInsight(world).execute({ ...ref, timeZone }));
    expect(job).toMatchObject({ kind: studentInsightJobKind, ownerId: ref.actor.id });
    const writer = await runInsightJob(world);

    const sent = JSON.stringify(writer.requests);
    expect(sent).not.toContain(ana.firstName);
    expect(sent).not.toContain(ana.lastName);
    expect(sent).not.toContain('divorcing');
    expect(writer.requests[0]).toMatchObject({
      language: ref.actor.language,
      stats: { average: 40, missing: 1 },
      recentGrades: [{ title: 'Fractions quiz', status: 'graded', percentage: 40 }],
    });

    const view = valueOf(await new GetStudent360(world).execute({ ...ref, timeZone }));
    expect(view.insight).toEqual({
      schoolId: ref.actor.schoolId,
      studentId: ana.id,
      teacherId: ref.actor.id,
      bullets: [
        'Scores fell over the last three assignments.',
        'Two absences this month.',
        'Check in about the missing essay.',
      ],
      generatedAt: world.clock.now(),
    });
    const colleague = colleagueOf(ref.actor, 'school_admin');
    expect(
      valueOf(await new GetStudent360(world).execute({ ...ref, actor: colleague, timeZone }))
        .insight,
    ).toBeNull();
  });

  it('needs AI access and a class the actor manages', async () => {
    const world = makeWorld();
    const { ref } = await anaWithWork(world);
    expect(
      await new RequestStudentInsight(world).execute({ ...ref, actor: outsider, timeZone }),
    ).toEqual(notFound);
    advanceDays(world, 8);
    expect(await new RequestStudentInsight(world).execute({ ...ref, timeZone })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });

  it('fails the job when the writer fails, keeping no insight', async () => {
    const world = makeWorld();
    const { ref } = await anaWithWork(world);
    const job = valueOf(await new RequestStudentInsight(world).execute({ ...ref, timeZone }));
    await runInsightJob(
      world,
      new FakeInsightWriter({ ok: false, error: { code: 'invalid_output' } }),
    );
    expect(await world.jobs.findForOwner(ref.actor.schoolId, ref.actor.id, job.id)).toMatchObject({
      status: 'failed',
      error: 'invalid_output',
    });
    expect(
      valueOf(await new GetStudent360(world).execute({ ...ref, timeZone })).insight,
    ).toBeNull();
  });
});
