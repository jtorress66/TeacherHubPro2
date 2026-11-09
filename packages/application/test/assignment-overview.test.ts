import { describe, expect, it } from 'vitest';
import type { QuestionId, SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { GetAssignmentOverview, IssueLinks, SaveQuestions, SubmitAnswers } from '../src/index.ts';
import { gradedClass, valueOf } from './classroom.ts';
import { makeWorld } from './world.ts';

const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

const question = {
  id: 'q1' as QuestionId,
  type: 'short_answer' as const,
  prompt: 'Why day and night?',
  points: 6,
};

describe('GetAssignmentOverview', () => {
  it('tells the teacher what students can see yet, who has a link and who has handed in', async () => {
    const world = makeWorld();
    const setup = await gradedClass(world);
    const assignment = await setup.assign('Space essay', 'Pruebas cortas', 100);
    const base = { actor: setup.actor, classId: setup.cls.id, assignmentId: assignment.id };
    const overview = new GetAssignmentOverview(world);

    expect(valueOf(await overview.execute(base))).toEqual({
      ready: false,
      questionCount: 0,
      fileCount: 0,
      studentCount: 3,
      linkedCount: 0,
      handedIn: 0,
      toReview: 0,
      confirmed: 0,
    });

    valueOf(await new SaveQuestions(world).execute({ ...base, questions: [question] }));
    const issued = valueOf(
      await new IssueLinks(world).execute({ actor: setup.actor, classId: setup.cls.id }),
    );
    const [first] = issued;
    if (first === undefined) throw new Error('no link');
    valueOf(
      await new SubmitAnswers(world).execute({
        token: first.token,
        assignmentId: assignment.id,
        answers: { q1: 'The Earth turns.' },
      }),
    );

    expect(valueOf(await overview.execute(base))).toEqual({
      ready: true,
      questionCount: 1,
      fileCount: 0,
      studentCount: 3,
      linkedCount: 3,
      handedIn: 1,
      toReview: 1,
      confirmed: 0,
    });
  });

  it('keeps another school’s assignment out of reach', async () => {
    const world = makeWorld();
    const setup = await gradedClass(world);
    const assignment = await setup.assign('Space essay', 'Pruebas cortas', 100);

    expect(
      await new GetAssignmentOverview(world).execute({
        actor: outsider,
        classId: setup.cls.id,
        assignmentId: assignment.id,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
