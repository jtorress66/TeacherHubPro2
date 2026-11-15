import { describe, expect, it } from 'vitest';
import {
  ltiAgsScope,
  type GameId,
  type LtiCourse,
  type LtiPlacedItem,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import { aGame, aUser } from '@thp/testing';
import {
  JobHandlerRegistry,
  ListLtiGradeTargets,
  LtiGradeSendHandler,
  ltiGradeSendJobKind,
  RegisterLtiPlatform,
  RunNextJob,
  StartLtiGradeSend,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { asAdmin, details, ltiWorld, type LtiWorld } from './lti-world.ts';

const lineItemsUrl = 'https://lms.lincoln.edu/api/lti/courses/9/line_items';
const gradeScopes = [ltiAgsScope.lineItem, ltiAgsScope.score];

/**
 * A teacher's class (Ana, Ben, Cara) with a 10-point quiz placed in their course "Science 5",
 * whose gradebook takes grades; Ana and Ben are linked to the course system, Cara is not.
 * Ana's 9 is confirmed, Ben's grade is pending, Cara has 7.
 */
async function sendable(world: LtiWorld, courseOverrides: Partial<LtiCourse> = {}) {
  const setup = await gradedClass(world);
  const { actor, cls } = setup;
  const admin = asAdmin(actor);
  await world.users.save(admin);
  const platform = valueOf(
    await new RegisterLtiPlatform(world).execute({ actor: admin, details: details() }),
  );
  // Back to an ordinary teacher, who manages only their own class.
  await world.users.save(actor);
  const quiz = await setup.assign('Space quiz', 'Pruebas cortas', 10);
  const item: LtiPlacedItem = { kind: 'assignment', id: quiz.id };
  const place = (placed: LtiPlacedItem, contextId = 'course-9') =>
    world.ltiPlacements.save({
      platformId: platform.id,
      contextId,
      item: placed,
      schoolId: actor.schoolId,
      teacherId: actor.id,
      placedAt: world.clock.now(),
    });
  await place(item);
  const course: LtiCourse = {
    platformId: platform.id,
    schoolId: actor.schoolId,
    teacherId: actor.id,
    contextId: 'course-9',
    title: 'Science 5',
    membershipsUrl: null,
    lineItemsUrl,
    gradeScopes,
    lastLaunchedAt: world.clock.now(),
    ...courseOverrides,
  };
  await world.ltiCourses.save(course);
  await world.ltiStudentLinks.link(actor.schoolId, platform.id, 'canvas-ana', setup.ana.id);
  await world.ltiStudentLinks.link(actor.schoolId, platform.id, 'canvas-ben', setup.ben.id);
  await setup.grade(quiz.id, [
    { studentId: setup.ana.id, status: 'graded', score: 9 },
    { studentId: setup.ben.id, status: 'pending' },
    { studentId: setup.cara.id, status: 'graded', score: 7 },
  ]);
  const target = {
    actor,
    classId: cls.id,
    assignmentId: quiz.id,
    platformId: platform.id,
    contextId: 'course-9',
  };
  return { ...setup, platform, quiz, item, place, course, target };
}

const runJobs = (world: LtiWorld) =>
  new RunNextJob({
    jobs: world.jobs,
    handlers: new JobHandlerRegistry([new LtiGradeSendHandler(world)]),
  }).execute();

async function sendAndRun(world: LtiWorld, target: Parameters<StartLtiGradeSend['execute']>[0]) {
  const { jobId } = valueOf(await new StartLtiGradeSend(world).execute(target));
  await runJobs(world);
  const job = await world.jobs.findForOwner(target.actor.schoolId, target.actor.id, jobId);
  if (job === null) throw new Error('no job');
  return job;
}

const sentApprovals = (world: LtiWorld) =>
  world.auditLog.events.filter((event) => event.action === 'grades_sent_to_course');

describe('ListLtiGradeTargets', () => {
  it('lists the courses the assignment is placed in whose gradebook takes grades', async () => {
    const world = ltiWorld();
    const { actor, cls, quiz, platform } = await sendable(world);

    expect(
      valueOf(
        await new ListLtiGradeTargets(world).execute({
          actor,
          classId: cls.id,
          assignmentId: quiz.id,
        }),
      ),
    ).toEqual([{ platformId: platform.id, contextId: 'course-9', title: 'Science 5' }]);
  });

  it('lists a course where the assignment’s graded game is placed', async () => {
    const world = ltiWorld();
    const { actor, cls, quiz, platform, place, course } = await sendable(world);
    const game = aGame({
      id: 'planets' as GameId,
      schoolId: actor.schoolId,
      teacherId: actor.id,
      classId: cls.id,
    });
    await world.games.save({ ...game, grading: { ...game.grading, assignmentId: quiz.id } });
    await place({ kind: 'game', id: game.id }, 'course-10');
    await world.ltiCourses.save({ ...course, contextId: 'course-10', title: 'Science 5 (B)' });

    const targets = valueOf(
      await new ListLtiGradeTargets(world).execute({
        actor,
        classId: cls.id,
        assignmentId: quiz.id,
      }),
    );

    expect(targets).toEqual([
      { platformId: platform.id, contextId: 'course-9', title: 'Science 5' },
      { platformId: platform.id, contextId: 'course-10', title: 'Science 5 (B)' },
    ]);
  });

  it('lists nothing for a course without the score scope, or one the teacher never opened', async () => {
    const world = ltiWorld();
    const { actor, cls, quiz, course } = await sendable(world, {
      gradeScopes: [ltiAgsScope.lineItem],
    });
    const input = { actor, classId: cls.id, assignmentId: quiz.id };
    expect(valueOf(await new ListLtiGradeTargets(world).execute(input))).toEqual([]);

    await world.ltiCourses.save({ ...course, gradeScopes, lineItemsUrl: null });
    expect(valueOf(await new ListLtiGradeTargets(world).execute(input))).toEqual([]);
  });

  it('refuses a teacher who does not manage the class', async () => {
    const world = ltiWorld();
    const { actor, cls, quiz } = await sendable(world);
    const colleague = colleagueOf(actor);
    await world.users.save(colleague);

    expect(
      (
        await new ListLtiGradeTargets(world).execute({
          actor: colleague,
          classId: cls.id,
          assignmentId: quiz.id,
        })
      ).ok,
    ).toBe(false);
  });
});

describe('StartLtiGradeSend and LtiGradeSendHandler', () => {
  it('sends only confirmed grades of linked students, and counts the rest', async () => {
    const world = ltiWorld();
    const { target } = await sendable(world);

    const job = await sendAndRun(world, target);

    expect(job.kind).toBe(ltiGradeSendJobKind);
    expect(job.status).toBe('completed');
    expect(job.result).toEqual({
      course: 'Science 5',
      sent: 1,
      notConfirmed: 1,
      notLinked: 1,
      failed: 0,
    });
    expect(world.ltiGrades.gradebook(lineItemsUrl)).toEqual({
      lineItems: [{ resourceId: target.assignmentId, scoreMaximum: 10 }],
      scores: [
        {
          userId: 'canvas-ana',
          scoreGiven: 9,
          scoreMaximum: 10,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          timestamp: world.clock.now().toISOString(),
        },
      ],
    });
    expect(world.ltiGrades.calls[0]?.request.lineItem).toEqual({
      scoreMaximum: 10,
      label: 'Space quiz',
      resourceId: target.assignmentId,
      tag: 'teacherhubpro',
    });
  });

  it('logs the send as the teacher’s approval, once, with how many grades went', async () => {
    const world = ltiWorld();
    const { target, cls } = await sendable(world);

    await sendAndRun(world, target);

    expect(sentApprovals(world)).toEqual([
      expect.objectContaining({
        actorId: target.actor.id,
        schoolId: target.actor.schoolId,
        targetId: target.assignmentId,
        classId: cls.id,
        count: 1,
      }),
    ]);
  });

  it('sends again with the latest grades when asked again', async () => {
    const world = ltiWorld();
    const { target, grade, ana, ben } = await sendable(world);
    await sendAndRun(world, target);
    world.clock.advanceBy(60_000);
    await grade(target.assignmentId, [
      { studentId: ana.id, status: 'graded', score: 10 },
      { studentId: ben.id, status: 'late', score: 6 },
    ]);

    const again = await sendAndRun(world, target);

    expect(again.result).toMatchObject({ sent: 2, notConfirmed: 0, notLinked: 1 });
    const scores = world.ltiGrades.gradebook(lineItemsUrl).scores;
    expect(scores.map((s) => [s.userId, s.scoreGiven])).toEqual([
      ['canvas-ana', 10],
      ['canvas-ben', 6],
    ]);
    expect(sentApprovals(world).map((event) => event.count)).toEqual([1, 2]);
  });

  it('logs no approval when no grade went to the course', async () => {
    const world = ltiWorld();
    const { target, grade, ana } = await sendable(world);
    await grade(target.assignmentId, [{ studentId: ana.id, status: 'missing' }]);

    const job = await sendAndRun(world, target);

    expect(job.result).toMatchObject({ sent: 0, notConfirmed: 2, notLinked: 1 });
    expect(sentApprovals(world)).toEqual([]);
  });

  it('counts scores the course system would not take', async () => {
    const world = ltiWorld();
    const { target } = await sendable(world);
    world.ltiGrades.refuseScoreOf('canvas-ana');

    const job = await sendAndRun(world, target);

    expect(job.result).toMatchObject({ sent: 0, failed: 1 });
    expect(sentApprovals(world)).toEqual([]);
  });

  it.each([
    ['not_allowed', 'course_system_refused'],
    ['unavailable', 'course_system_unavailable'],
  ] as const)('fails as %s when the course system answers so', async (refusal, error) => {
    const world = ltiWorld();
    const { target } = await sendable(world);
    world.ltiGrades.failWith(refusal);

    const job = await sendAndRun(world, target);

    expect(job.status).toBe('failed');
    expect(job.error).toBe(error);
    expect(sentApprovals(world)).toEqual([]);
  });

  it('refuses a course whose gradebook does not take grades', async () => {
    const world = ltiWorld();
    const { target } = await sendable(world, { gradeScopes: [ltiAgsScope.lineItem] });

    expect(await new StartLtiGradeSend(world).execute(target)).toEqual({
      ok: false,
      error: { code: 'course_system_refused' },
    });
    expect(await world.jobs.claimNext([ltiGradeSendJobKind])).toBeNull();
  });

  it('refuses a course the assignment is not placed in, or the teacher never opened', async () => {
    const world = ltiWorld();
    const { target, course } = await sendable(world);
    await world.ltiCourses.save({ ...course, contextId: 'course-11' });

    for (const contextId of ['course-11', 'course-12']) {
      expect(await new StartLtiGradeSend(world).execute({ ...target, contextId })).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
    }
  });

  it('refuses a colleague who does not manage the class', async () => {
    const world = ltiWorld();
    const { target } = await sendable(world);
    const colleague = colleagueOf(target.actor);
    await world.users.save(colleague);

    expect((await new StartLtiGradeSend(world).execute({ ...target, actor: colleague })).ok).toBe(
      false,
    );
  });

  it('never reaches another school’s assignment', async () => {
    const world = ltiWorld();
    const { target } = await sendable(world);
    const outsider: User = aUser({
      id: 'outsider' as UserId,
      schoolId: 'other-school' as SchoolId,
      role: 'school_admin',
    });

    expect(await new StartLtiGradeSend(world).execute({ ...target, actor: outsider })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('sends nothing when the teacher lost the class before the job ran', async () => {
    const world = ltiWorld();
    const { target, cls } = await sendable(world);
    valueOf(await new StartLtiGradeSend(world).execute(target));
    await world.classes.save({ ...cls, teacherId: 'someone-else' as UserId });

    await runJobs(world);

    expect(world.ltiGrades.calls).toEqual([]);
    expect(sentApprovals(world)).toEqual([]);
  });
});
