import { describe, expect, it } from 'vitest';
import type {
  ApprovalAction,
  AssignmentId,
  AuditEventId,
  ClassId,
  GameId,
  LearningPathId,
  SchoolId,
  SubmissionId,
  User,
  UserId,
} from '@thp/domain';
import {
  aClass,
  aGame,
  aLearningPath,
  anAssignment,
  aPrepBatch,
  aSubmission,
  aUser,
} from '@thp/testing';
import { ListApprovals, maxListedApprovals, recordApproval } from '../src/index.ts';
import { makeWorld } from './world.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const admin = aUser({
  id: 'admin-1' as UserId,
  schoolId: schoolA,
  role: 'school_admin',
  email: 'admin@school.edu',
  name: 'Rosa Admin',
});
const ana = aUser({ id: 'teacher-1' as UserId, schoolId: schoolA, name: 'Ana López' });
const ben = aUser({
  id: 'teacher-2' as UserId,
  schoolId: schoolA,
  email: 'ben@school.edu',
  name: 'Ben Ruiz',
});
const otherAdmin = aUser({
  id: 'admin-9' as UserId,
  schoolId: schoolB,
  role: 'school_admin',
  email: 'other@school.edu',
});
const science = aClass({ id: 'class-1' as ClassId, schoolId: schoolA, name: 'Science 5' });

async function withApprovals() {
  const world = makeWorld();
  for (const user of [admin, ana, ben]) await world.users.save(user);
  await world.classes.save(science);
  const approve = async (
    actor: User,
    action: ApprovalAction,
    targetId: string,
    classId: ClassId | null = science.id,
  ) => {
    await recordApproval(world, { actor, action, schoolId: actor.schoolId, targetId, classId });
    world.clock.advanceBy(60_000);
  };
  await approve(ana, 'ai_grade_approved', 'submission-1');
  await approve(ben, 'prep_approved', 'batch-1');
  await approve(ana, 'learning_path_assigned', 'path-1', null);
  await world.auditLog.record({
    id: 'not-an-approval' as AuditEventId,
    schoolId: schoolA,
    actorId: ana.id,
    action: 'student_added',
    targetId: null,
    at: world.clock.now(),
    review: null,
    count: null,
    classId: null,
  });
  return world;
}

type Listed = Awaited<ReturnType<ListApprovals['execute']>>;

const targets = (result: Listed) =>
  result.ok ? result.value.rows.map((row) => row.event.targetId) : result;

describe('ListApprovals', () => {
  it('shows a school admin every approval in the school, newest first, with names', async () => {
    const world = await withApprovals();

    const listed = await new ListApprovals(world).execute({
      actor: admin,
      schoolId: schoolA,
      filter: {},
    });

    expect(targets(listed)).toEqual(['path-1', 'batch-1', 'submission-1']);
    expect(listed.ok && listed.value.rows.map((row) => [row.teacherName, row.className])).toEqual([
      ['Ana López', null],
      ['Ben Ruiz', 'Science 5'],
      ['Ana López', 'Science 5'],
    ]);
    expect(listed.ok && listed.value.teachers.map((teacher) => teacher.name)).toEqual([
      'Ana López',
      'Ben Ruiz',
      'Rosa Admin',
    ]);
    expect(listed.ok && listed.value.limited).toBe(false);
  });

  it('lets an admin narrow the list to one teacher, one kind and a time range', async () => {
    const world = await withApprovals();
    const list = (filter: Parameters<ListApprovals['execute']>[0]['filter']) =>
      new ListApprovals(world).execute({ actor: admin, schoolId: schoolA, filter });

    expect(targets(await list({ teacherId: ben.id }))).toEqual(['batch-1']);
    expect(targets(await list({ action: 'ai_grade_approved' }))).toEqual(['submission-1']);
    expect(
      targets(
        await list({
          from: new Date('2026-09-01T08:01:00.000Z'),
          to: new Date('2026-09-01T08:02:00.000Z'),
        }),
      ),
    ).toEqual(['batch-1']);
  });

  it('shows a teacher only their own approvals, whoever they ask about', async () => {
    const world = await withApprovals();

    const own = await new ListApprovals(world).execute({
      actor: ana,
      schoolId: schoolA,
      filter: {},
    });
    const asked = await new ListApprovals(world).execute({
      actor: ana,
      schoolId: schoolA,
      filter: { teacherId: ben.id },
    });

    expect(targets(own)).toEqual(['path-1', 'submission-1']);
    expect(targets(asked)).toEqual(['path-1', 'submission-1']);
    expect(own.ok && own.value.teachers).toEqual([]);
  });

  it('refuses anyone from another school, admin or not', async () => {
    const world = await withApprovals();
    const outsider = aUser({ id: 'teacher-9' as UserId, schoolId: schoolB });

    for (const actor of [otherAdmin, outsider]) {
      expect(
        await new ListApprovals(world).execute({ actor, schoolId: schoolA, filter: {} }),
      ).toEqual({ ok: false, error: { code: 'forbidden' } });
    }
  });

  it('lists at most 500 approvals and says when there may be more', async () => {
    const world = makeWorld();
    for (let i = 0; i <= maxListedApprovals; i += 1) {
      await recordApproval(world, {
        actor: ana,
        action: 'ai_grade_approved',
        schoolId: schoolA,
        targetId: `s-${String(i)}`,
        classId: null,
      });
    }

    const listed = await new ListApprovals(world).execute({
      actor: admin,
      schoolId: schoolA,
      filter: {},
    });

    expect(maxListedApprovals).toBe(500);
    expect(listed.ok && listed.value.rows).toHaveLength(500);
    expect(listed.ok && listed.value.limited).toBe(true);
  });

  describe('names the approved item', () => {
    async function withItems(schoolId: SchoolId) {
      const world = await withApprovals();
      const quiz = anAssignment({
        id: 'assignment-1' as AssignmentId,
        schoolId,
        title: 'Fractions quiz',
      });
      await world.assignments.save(quiz);
      await world.submissions.save(
        aSubmission({ id: 'submission-7' as SubmissionId, schoolId, assignmentId: quiz.id }),
      );
      await world.games.save(aGame({ id: 'game-1' as GameId, schoolId, title: 'Planet race' }));
      await world.prepBatches.save({ ...aPrepBatch('batch-7'), schoolId });
      await world.learningPaths.save(
        aLearningPath({ id: 'path-7' as LearningPathId, schoolId, subject: 'science' }),
      );
      const approve = async (action: ApprovalAction, targetId: string) => {
        await recordApproval(world, {
          actor: ana,
          action,
          schoolId: schoolA,
          targetId,
          classId: science.id,
        });
        world.clock.advanceBy(60_000);
      };
      await approve('ai_grade_approved', 'submission-7');
      await approve('ai_grade_approved', 'submission-7');
      await approve('game_grades_approved', 'game-1');
      await approve('prep_approved', 'batch-7');
      await approve('learning_path_assigned', 'path-7');
      return world;
    }

    const items = async (world: Awaited<ReturnType<typeof withItems>>) => {
      const listed = await new ListApprovals(world).execute({
        actor: admin,
        schoolId: schoolA,
        filter: {},
      });
      return listed.ok ? listed.value.rows.map((row) => [row.event.targetId, row.item]) : listed;
    };

    it('by assignment title, game title, week start or subject; never a student', async () => {
      expect(await items(await withItems(schoolA))).toEqual([
        ['path-7', { kind: 'subject', subject: 'science' }],
        ['batch-7', { kind: 'week', start: '2026-11-09' }],
        ['game-1', { kind: 'title', text: 'Planet race' }],
        ['submission-7', { kind: 'title', text: 'Fractions quiz' }],
        ['submission-7', { kind: 'title', text: 'Fractions quiz' }],
        ['path-1', { kind: 'deleted' }],
        ['batch-1', { kind: 'deleted' }],
        ['submission-1', { kind: 'deleted' }],
      ]);
    });

    it('says the item was deleted when its assignment is gone', async () => {
      const world = await withItems(schoolA);
      await world.assignments.delete(schoolA, 'assignment-1' as AssignmentId);

      const listed = await items(world);

      expect(Array.isArray(listed) && listed.slice(3, 5)).toEqual([
        ['submission-7', { kind: 'deleted' }],
        ['submission-7', { kind: 'deleted' }],
      ]);
    });

    it("never resolves another school's items, even with the same ids", async () => {
      const listed = await items(await withItems(schoolB));

      expect(Array.isArray(listed) && listed.map(([, item]) => item)).toEqual(
        Array.from({ length: 8 }, () => ({ kind: 'deleted' })),
      );
    });

    it("reads a prep batch only as its approving teacher's", async () => {
      const world = await withItems(schoolA);
      await world.prepBatches.save({ ...aPrepBatch('batch-7'), teacherId: ben.id });

      const listed = await items(world);

      expect(Array.isArray(listed) && listed[1]).toEqual(['batch-7', { kind: 'deleted' }]);
    });
  });
});
