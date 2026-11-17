import { describe, expect, it } from 'vitest';
import { sampleHelpStudent, type SchoolId, type UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  CreateClass,
  CreateSampleClass,
  GetCommandCenter,
  RemoveSampleClass,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { sampleText } from './sample-text.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

const create = (world: World, actor: Parameters<CreateSampleClass['execute']>[0]['actor']) =>
  new CreateSampleClass(world).execute({ actor, text: sampleText, timeZone: 'UTC' });

describe('CreateSampleClass', () => {
  it('fills a made-up class with students, attendance, grades, a plan, a quiz and a game', async () => {
    const world = makeWorld(); // Tuesday 2026-09-01
    const { user } = await signedUp(world);

    const cls = await create(world, user);

    expect(cls).toMatchObject({ name: sampleText.className, sample: true, teacherId: user.id });
    const students = await world.students.listByClass(cls.schoolId, cls.id);
    expect(students.map((s) => s.firstName)).toEqual(sampleText.students);
    const days = await world.attendanceSessions.listByClass(cls.schoolId, cls.id);
    expect(days.map((d) => [d.date, d.status])).toEqual([
      ['2026-08-25', 'submitted'],
      ['2026-08-26', 'submitted'],
      ['2026-08-27', 'submitted'],
      ['2026-08-28', 'submitted'],
      ['2026-08-31', 'submitted'],
    ]);
    expect(await world.gradeCategories.listByClass(cls.schoolId, cls.id)).toHaveLength(4);

    const assignments = await world.assignments.listByClass(cls.schoolId, cls.id);
    expect(assignments.map((a) => a.title).sort()).toEqual(
      [sampleText.homework, sampleText.quiz, sampleText.onlineQuiz].sort(),
    );
    const online = assignments.find((a) => a.title === sampleText.onlineQuiz);
    expect(online?.questions.map((q) => q.type)).toEqual([
      'multiple_choice',
      'true_false',
      'short_answer',
    ]);
    if (online === undefined) throw new Error('no online quiz');
    const submissions = await world.submissions.listByAssignment(cls.schoolId, online.id);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      status: 'ai_graded',
      aiDraft: { score: 9, feedback: sampleText.feedback },
      finalScore: null,
    });

    const [plan] = await world.lessonPlans.listByTeacher(cls.schoolId, user.id);
    expect(plan).toMatchObject({ classId: cls.id, body: { kind: 'weekly' } });
    expect(JSON.stringify(plan?.body)).toContain('2026-08-31');

    const [game] = await world.games.listByClass(cls.schoolId, cls.id);
    expect(game).toMatchObject({ title: sampleText.game.title, mode: 'quiz' });
    expect(game?.content.items).toHaveLength(5);
  });

  it('gives the Command Center an answer to review and one student who may need help', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    await create(world, user);

    const center = valueOf(
      await new GetCommandCenter(world).execute({ actor: user, timeZone: 'UTC' }),
    );

    expect(center.atRisk.map((row) => row.student.firstName)).toEqual([
      sampleText.students[sampleHelpStudent],
    ]);
    expect(center.stats.toGrade).toBe(1);
  });

  it('keeps one sample class: asking again returns the one already there', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const first = await create(world, user);

    expect((await create(world, user)).id).toBe(first.id);
    expect(await world.classes.listByTeacher(user.schoolId, user.id)).toHaveLength(1);
  });
});

describe('RemoveSampleClass', () => {
  it('takes the sample out of every list, and a new one can be added later', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const sample = await create(world, user);

    valueOf(await new RemoveSampleClass(world).execute({ actor: user, classId: sample.id }));

    expect(await world.classes.listByTeacher(user.schoolId, user.id)).toEqual([]);
    const again = await create(world, user);
    expect(again.id).not.toBe(sample.id);
  });

  it("never removes the teacher's real class", async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const real = valueOf(
      await new CreateClass(world).execute({ actor: user, details: { name: 'Science 4' } }),
    );

    const removed = await new RemoveSampleClass(world).execute({ actor: user, classId: real.id });

    expect(removed).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await world.classes.listByTeacher(user.schoolId, user.id)).toHaveLength(1);
  });

  it("cannot reach another school's sample class", async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const sample = await create(world, user);

    const removed = await new RemoveSampleClass(world).execute({
      actor: outsider,
      classId: sample.id,
    });

    expect(removed.ok).toBe(false);
    expect(await world.classes.listByTeacher(user.schoolId, user.id)).toHaveLength(1);
  });
});
