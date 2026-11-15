import { describe, expect, it } from 'vitest';
import { aGame, aStudent } from '@thp/testing';
import {
  ltiClaim,
  type ClassId,
  type GameId,
  type LtiPlacedItem,
  type QuestionId,
  type SchoolId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import {
  FinishGameRound,
  GetStudentAssignment,
  RegisterLtiPlatform,
  SaveQuestions,
  StartGameRound,
  SubmitAnswers,
  studentPassLifetimeMs,
} from '../src/index.ts';
import { gradedClass, valueOf } from './classroom.ts';
import { asAdmin, details, launch, ltiWorld, type LtiWorld } from './lti-world.ts';

const learner = {
  sub: 'canvas-ana',
  [ltiClaim.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  [ltiClaim.context]: { id: 'course-9', title: 'Science 5' },
};
const opening = (item: LtiPlacedItem) => ({
  [ltiClaim.custom]: { thp_kind: item.kind, thp_id: item.id },
});
const notFound = { ok: false, error: { code: 'not_found' } };

/**
 * A class with a ready quiz and a not-ready assignment, a game, the course system registered,
 * the quiz and game placed in course-9, and Ana linked to her course system user.
 */
async function placedClass(world: LtiWorld) {
  const setup = await gradedClass(world);
  const admin = asAdmin(setup.actor);
  await world.users.save(admin);
  const platform = valueOf(
    await new RegisterLtiPlatform(world).execute({ actor: admin, details: details() }),
  );
  const quiz = await setup.assign('Quiz', 'Pruebas cortas', 2);
  const other = await setup.assign('Other quiz', 'Pruebas cortas', 2);
  for (const assignment of [quiz, other]) {
    valueOf(
      await new SaveQuestions(world).execute({
        actor: setup.actor,
        classId: setup.cls.id,
        assignmentId: assignment.id,
        questions: [
          { id: 'q1' as QuestionId, type: 'true_false', prompt: 'Sun', answer: true, points: 2 },
        ],
      }),
    );
  }
  const game = aGame({
    id: 'planets' as GameId,
    schoolId: setup.actor.schoolId,
    teacherId: setup.actor.id,
    classId: setup.cls.id,
  });
  await world.games.save(game);
  const quizItem: LtiPlacedItem = { kind: 'assignment', id: quiz.id };
  const gameItem: LtiPlacedItem = { kind: 'game', id: game.id };
  for (const item of [quizItem, gameItem]) {
    await world.ltiPlacements.save({
      platformId: platform.id,
      contextId: 'course-9',
      item,
      schoolId: setup.actor.schoolId,
      teacherId: setup.actor.id,
      placedAt: world.clock.now(),
    });
  }
  await world.ltiStudentLinks.link(setup.actor.schoolId, platform.id, 'canvas-ana', setup.ana.id);
  return { ...setup, platform, quiz, other, game, quizItem, gameItem };
}

/** The pass of a learner's launch that opened an item. */
async function passOf(world: LtiWorld, claims: Record<string, unknown>) {
  const outcome = valueOf(await launch(world, claims));
  if (outcome.kind !== 'studentItem') throw new Error(outcome.kind);
  return outcome;
}

describe('CompleteLtiLaunch for a student opening a placed item', () => {
  it('lets a linked student on the class list open the placed assignment, and only it', async () => {
    const world = ltiWorld();
    const { quiz, other, game, quizItem } = await placedClass(world);

    const outcome = await passOf(world, { ...learner, ...opening(quizItem) });

    expect(outcome).toMatchObject({ kind: 'studentItem', item: quizItem, locale: 'es' });
    const { pass } = outcome;
    const view = valueOf(
      await new GetStudentAssignment(world).execute({ pass, assignmentId: quiz.id }),
    );
    expect(view.assignment.title).toBe('Quiz');
    expect(await new GetStudentAssignment(world).execute({ pass, assignmentId: other.id })).toEqual(
      notFound,
    );
    expect(await new StartGameRound(world).execute({ pass, gameId: game.id })).toEqual(notFound);
  });

  it('ties the answers to the roster student behind the pass', async () => {
    const world = ltiWorld();
    const { quiz, quizItem, ana } = await placedClass(world);
    const { pass } = await passOf(world, { ...learner, ...opening(quizItem) });

    valueOf(
      await new SubmitAnswers(world).execute({
        pass,
        assignmentId: quiz.id,
        answers: { q1: 'true' },
      }),
    );

    const submission = await world.submissions.findFor(ana.schoolId, ana.id, quiz.id);
    expect(submission?.studentId).toBe(ana.id);
  });

  it('lets a linked student play the placed game, saved as theirs', async () => {
    const world = ltiWorld();
    const { game, gameItem, quiz, ana } = await placedClass(world);
    const { pass } = await passOf(world, { ...learner, ...opening(gameItem) });

    const round = valueOf(await new StartGameRound(world).execute({ pass, gameId: game.id }));
    valueOf(
      await new FinishGameRound(world).execute({
        pass,
        gameId: game.id,
        mode: round.mode,
        seed: round.seed,
        answers: [],
        durationMs: 1000,
      }),
    );

    const plays = await world.gamePlays.listByGame(ana.schoolId, game.id);
    expect(plays.map((play) => play.studentId)).toEqual([ana.id]);
    expect(await new GetStudentAssignment(world).execute({ pass, assignmentId: quiz.id })).toEqual(
      notFound,
    );
  });

  it('gives no teacher session and no student link to a student', async () => {
    const world = ltiWorld();
    const { quizItem, ana } = await placedClass(world);

    const outcome = await passOf(world, { ...learner, ...opening(quizItem) });

    expect(Object.keys(outcome).sort()).toEqual(['item', 'kind', 'locale', 'pass']);
    expect(await world.studentLinks.listByClass(ana.schoolId, ana.classId)).toEqual([]);
  });

  it('sends a learner the course system has not linked to the ask-your-teacher page', async () => {
    const world = ltiWorld();
    const { quizItem } = await placedClass(world);

    expect(
      valueOf(await launch(world, { ...learner, sub: 'canvas-stranger', ...opening(quizItem) })),
    ).toEqual({ kind: 'learnerNotOnList', locale: 'es' });
  });

  it('refuses a linked student who is not on the placed item’s class list', async () => {
    const world = ltiWorld();
    const { quizItem, platform, actor } = await placedClass(world);
    const elsewhere = aStudent({
      id: 'dee' as StudentId,
      schoolId: actor.schoolId,
      classId: 'other-class' as ClassId,
      firstName: 'Dee',
      lastName: 'Ruiz',
    });
    await world.students.save(elsewhere);
    await world.ltiStudentLinks.link(actor.schoolId, platform.id, 'canvas-dee', elsewhere.id);

    expect(
      valueOf(await launch(world, { ...learner, sub: 'canvas-dee', ...opening(quizItem) })).kind,
    ).toBe('learnerNotOnList');
  });

  it('refuses an item that was not placed in this course, or is not ready, or is gone', async () => {
    const world = ltiWorld();
    const { other, quizItem } = await placedClass(world);
    const otherCourse = { [ltiClaim.context]: { id: 'course-7' } };

    for (const claims of [
      opening({ kind: 'assignment', id: other.id }),
      { ...opening(quizItem), ...otherCourse },
      opening({ kind: 'game', id: 'gone' as GameId }),
    ]) {
      expect(valueOf(await launch(world, { ...learner, ...claims })).kind).toBe('learnerNotOnList');
    }
  });

  it('never reaches another school’s student or item', async () => {
    const world = ltiWorld();
    const { quizItem, platform, quiz } = await placedClass(world);
    const otherSchool = 'other-school' as SchoolId;
    await world.ltiPlacements.save({
      platformId: platform.id,
      contextId: 'course-9',
      item: { kind: 'assignment', id: quiz.id },
      schoolId: otherSchool,
      teacherId: 'someone' as UserId,
      placedAt: world.clock.now(),
    });
    const outsider = aStudent({ id: 'out' as StudentId, schoolId: otherSchool });
    await world.students.save(outsider);
    await world.ltiStudentLinks.link(otherSchool, platform.id, 'canvas-out', outsider.id);

    expect(
      valueOf(await launch(world, { ...learner, sub: 'canvas-out', ...opening(quizItem) })).kind,
    ).toBe('learnerNotOnList');
  });

  it('still shows the not-yet page to a learner opening TeacherHubPro itself', async () => {
    const world = ltiWorld();
    await placedClass(world);

    expect(valueOf(await launch(world, learner))).toEqual({ kind: 'learnerNotYet', locale: 'es' });
  });

  it('stops working once the pass expires, or when tampered with', async () => {
    const world = ltiWorld();
    const { quiz, quizItem } = await placedClass(world);
    const { pass } = await passOf(world, { ...learner, ...opening(quizItem) });

    expect(
      await new GetStudentAssignment(world).execute({ pass: `${pass}x`, assignmentId: quiz.id }),
    ).toEqual(notFound);
    world.clock.advanceBy(studentPassLifetimeMs);
    expect(await new GetStudentAssignment(world).execute({ pass, assignmentId: quiz.id })).toEqual(
      notFound,
    );
  });

  it('refuses a pass whose student has left the roster', async () => {
    const world = ltiWorld();
    const { quiz, quizItem, ana } = await placedClass(world);
    const { pass } = await passOf(world, { ...learner, ...opening(quizItem) });

    await world.students.delete(ana.schoolId, ana.id);

    expect(await new GetStudentAssignment(world).execute({ pass, assignmentId: quiz.id })).toEqual(
      notFound,
    );
  });
});
