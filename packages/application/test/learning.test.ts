import { describe, expect, it } from 'vitest';
import type { Job, LearningPath, LearningPathId, StudentId } from '@thp/domain';
import { aLearningLesson } from '@thp/testing';
import {
  ArchiveLearningPath,
  AssignLearningPath,
  CreateClass,
  DeleteLearningPath,
  GetClassLearning,
  GetLearningPath,
  GetStudentLearning,
  IssueLinks,
  LearningPathHandler,
  ListStudentPaths,
  OpenLearnerLesson,
  RequestLearningPath,
  ReissueLink,
  SubmitLessonCheck,
  UpdateLearningPath,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { advanceDays, makeWorld, signedUp, type World } from './world.ts';

const notFound = { ok: false, error: { code: 'not_found' } };
const forbidden = { ok: false, error: { code: 'forbidden' } };

/** Right answers to the fixture lessons' checks are options 1, 0 and 1. */
const right = [1, 0, 1];

async function setUp(world: World) {
  const setup = await gradedClass(world);
  const links = valueOf(
    await new IssueLinks(world).execute({ actor: setup.actor, classId: setup.cls.id }),
  );
  const tokenOf = (studentId: string) =>
    links.find((row) => row.student.id === studentId)?.token ?? '';
  const request = (
    input: { studentId?: StudentId; subject?: string; topic?: string; esl?: boolean } = {},
  ) =>
    new RequestLearningPath(world).execute({
      actor: setup.actor,
      classId: setup.cls.id,
      subject: input.subject ?? 'math',
      grade: '4',
      lessonCount: 3,
      ...(input.studentId === undefined ? {} : { studentId: input.studentId }),
      ...(input.topic === undefined ? {} : { topic: input.topic }),
      ...(input.esl === undefined ? {} : { esl: input.esl }),
    });
  /** Runs a draft job, as the worker does, and returns the saved path. */
  const run = async (job: Job): Promise<LearningPath> => {
    const done = valueOf(await new LearningPathHandler(world).handle(job));
    const path = await world.learningPaths.findById(job.schoolId, done.pathId);
    if (path === null) throw new Error('no path saved');
    return path;
  };
  /** A path drafted for Ana and assigned. */
  const assignedPath = async (subject = 'math') => {
    const [job] = valueOf(await request({ studentId: setup.ana.id, subject }));
    if (job === undefined) throw new Error('no job');
    const path = await run(job);
    return valueOf(
      await new AssignLearningPath(world).execute({ actor: setup.actor, pathId: path.id }),
    );
  };
  const submit = (token: string, pathId: LearningPathId, lesson: number, answers: unknown[]) =>
    new SubmitLessonCheck(world).execute({ token, pathId, lesson, answers });
  return { ...setup, tokenOf, request, run, assignedPath, submit };
}

describe('RequestLearningPath', () => {
  it('queues one draft for a student, or one per student for the whole class', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    expect(valueOf(await s.request({ studentId: s.ana.id }))).toHaveLength(1);
    const jobs = valueOf(await s.request());
    expect(jobs).toHaveLength(3);
    expect(jobs.every((job) => job.kind === 'learning.generate')).toBe(true);
  });

  it('asks for ESL-level lessons when the teacher turns on ESL support', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const [job] = valueOf(await s.request({ studentId: s.ana.id, esl: true }));
    if (job === undefined) throw new Error('no job');
    await s.run(job);
    expect(world.pathWriter.requests[0]).toMatchObject({ esl: true });
  });

  it('sends the writer no student data: subject, grade, level and focus only', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const [job] = valueOf(await s.request({ studentId: s.ana.id, topic: 'Fractions' }));
    if (job === undefined) throw new Error('no job');
    const path = await s.run(job);
    expect(path).toMatchObject({
      status: 'draft',
      studentId: s.ana.id,
      classId: s.cls.id,
      teacherId: s.actor.id,
      level: 3,
      subject: 'math',
    });
    const sent = JSON.stringify(world.pathWriter.requests);
    for (const secret of ['Ana', 'Zayas', s.ana.id, s.cls.id, s.actor.id]) {
      expect(sent).not.toContain(secret);
    }
  });

  it('adapts the next path to the scores: up a level, with mastered objectives', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    for (const lesson of [0, 1, 2])
      valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, lesson, right));
    const [job] = valueOf(await s.request({ studentId: s.ana.id }));
    if (job === undefined) throw new Error('no job');
    expect((await s.run(job)).level).toBe(4);
    expect(world.pathWriter.requests.at(-1)).toMatchObject({
      level: 4,
      mastered: path.lessons.map((lesson) => lesson.objective),
      review: [],
    });
  });

  it('eases the next path and lists what to review after low scores', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, 0, [0, 1, 0]));
    const [job] = valueOf(await s.request({ studentId: s.ana.id }));
    if (job === undefined) throw new Error('no job');
    expect((await s.run(job)).level).toBe(2);
    expect(world.pathWriter.requests.at(-1)?.review).toEqual([path.lessons[0]?.objective]);
  });

  it('needs AI access, a class the teacher manages and a student of that class', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const colleague = colleagueOf(s.actor);
    expect(
      await new RequestLearningPath(world).execute({
        actor: colleague,
        classId: s.cls.id,
        subject: 'math',
        grade: '4',
      }),
    ).toEqual(forbidden);
    const other = await signedUp(world, 'other@school.edu');
    expect(
      await new RequestLearningPath(world).execute({
        actor: other.user,
        classId: s.cls.id,
        subject: 'math',
        grade: '4',
      }),
    ).toEqual(notFound);
    const otherClass = valueOf(
      await new CreateClass(world).execute({ actor: s.actor, details: { name: 'Other' } }),
    );
    expect(
      await new RequestLearningPath(world).execute({
        actor: s.actor,
        classId: otherClass.id,
        studentId: s.ana.id,
        subject: 'math',
        grade: '4',
      }),
    ).toEqual(notFound);
    expect(await s.request({ subject: 'alchemy' })).toMatchObject({
      ok: false,
      error: { field: 'subject' },
    });
    advanceDays(world, 60);
    expect(await s.request({ studentId: s.ana.id })).toEqual({
      ok: false,
      error: { code: 'subscription_required' },
    });
  });
});

describe('reviewing and assigning a path', () => {
  it('the teacher edits a draft, then assigns it; an assigned path is no longer edited', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const [job] = valueOf(await s.request({ studentId: s.ana.id }));
    if (job === undefined) throw new Error('no job');
    const draft = await s.run(job);
    const edited = valueOf(
      await new UpdateLearningPath(world).execute({
        actor: s.actor,
        pathId: draft.id,
        edit: {
          title: 'Fractions for Ana',
          lessons: [aLearningLesson(1), aLearningLesson(2), aLearningLesson(9)],
        },
      }),
    );
    expect(edited.title).toBe('Fractions for Ana');
    valueOf(await new AssignLearningPath(world).execute({ actor: s.actor, pathId: draft.id }));
    expect(
      await new UpdateLearningPath(world).execute({
        actor: s.actor,
        pathId: draft.id,
        edit: { title: 'Again' },
      }),
    ).toMatchObject({ ok: false, error: { field: 'status' } });
  });

  it('assigning a new path in the same subject archives the previous one', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const first = await s.assignedPath();
    const second = await s.assignedPath();
    expect((await world.learningPaths.findById(s.actor.schoolId, first.id))?.status).toBe(
      'archived',
    );
    expect(second.status).toBe('assigned');
    const science = await s.assignedPath('science');
    expect(science.status).toBe('assigned');
  });

  it('only the class’s teacher reaches a path; another school does not find it', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    const colleague = colleagueOf(s.actor);
    for (const UseCase of [GetLearningPath, ArchiveLearningPath, DeleteLearningPath]) {
      expect(await new UseCase(world).execute({ actor: colleague, pathId: path.id })).toEqual(
        forbidden,
      );
    }
    const other = await signedUp(world, 'other@school.edu');
    expect(
      await new GetLearningPath(world).execute({ actor: other.user, pathId: path.id }),
    ).toEqual(notFound);
  });

  it('archiving takes the path off the student’s link; deleting removes its attempts', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, 0, right));
    valueOf(await new ArchiveLearningPath(world).execute({ actor: s.actor, pathId: path.id }));
    expect(
      valueOf(await new ListStudentPaths(world).execute({ token: s.tokenOf(s.ana.id) })),
    ).toEqual([]);
    valueOf(await new DeleteLearningPath(world).execute({ actor: s.actor, pathId: path.id }));
    expect(await world.learningPaths.findById(s.actor.schoolId, path.id)).toBeNull();
    expect(await world.lessonAttempts.listByPaths(s.actor.schoolId, [path.id])).toEqual([]);
  });
});

describe('the student’s link', () => {
  it('shows only assigned paths, with progress, and never the answers', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const [job] = valueOf(await s.request({ studentId: s.ana.id }));
    if (job === undefined) throw new Error('no job');
    await s.run(job);
    expect(
      valueOf(await new ListStudentPaths(world).execute({ token: s.tokenOf(s.ana.id) })),
    ).toEqual([]);

    const path = await s.assignedPath();
    const listed = valueOf(
      await new ListStudentPaths(world).execute({ token: s.tokenOf(s.ana.id) }),
    );
    expect(listed).toEqual([
      expect.objectContaining({ id: path.id, title: path.title, done: 0, total: 3 }),
    ]);
    const lesson = valueOf(
      await new OpenLearnerLesson(world).execute({
        token: s.tokenOf(s.ana.id),
        pathId: path.id,
        lesson: 0,
      }),
    );
    expect(lesson.lesson.checks[0]).toEqual({
      prompt: path.lessons[0]?.checks[0]?.prompt,
      options: path.lessons[0]?.checks[0]?.options,
    });
    expect(JSON.stringify(lesson)).not.toContain('"answer"');
    expect(lesson).toMatchObject({ index: 0, count: 3, best: null });
  });

  it('scores the check on the server, shows corrections after, and updates progress', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    const result = valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, 0, [1, 1, 1]));
    expect(result).toEqual({
      score: 2,
      total: 3,
      percent: 67,
      corrections: [{ check: 1, answer: 0, right: path.lessons[0]?.checks[1]?.options[0] }],
    });
    const [listed] = valueOf(
      await new ListStudentPaths(world).execute({ token: s.tokenOf(s.ana.id) }),
    );
    expect(listed).toMatchObject({ done: 1, total: 3, average: 67 });
    const progress = valueOf(
      await new GetClassLearning(world).execute({ actor: s.actor, classId: s.cls.id }),
    );
    expect(progress.students.find((row) => row.studentId === s.ana.id)).toMatchObject({
      done: 1,
      total: 3,
      average: 67,
    });
  });

  it('another student, a replaced link, a missing lesson or an archived path reach nothing', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    expect(await s.submit(s.tokenOf(s.ben.id), path.id, 0, right)).toEqual(notFound);
    expect(
      await new OpenLearnerLesson(world).execute({
        token: s.tokenOf(s.ben.id),
        pathId: path.id,
        lesson: 0,
      }),
    ).toEqual(notFound);
    expect(await s.submit(s.tokenOf(s.ana.id), path.id, 7, right)).toEqual(notFound);
    expect(await s.submit('not-a-token', path.id, 0, right)).toEqual(notFound);
    valueOf(
      await new ReissueLink(world).execute({
        actor: s.actor,
        classId: s.cls.id,
        studentId: s.ana.id,
      }),
    );
    expect(await s.submit(s.tokenOf(s.ana.id), path.id, 0, right)).toEqual(notFound);
  });
});

describe('progress for the teacher', () => {
  it('shows each student of the class, and one student by subject with each path’s lessons', async () => {
    const world = makeWorld();
    const s = await setUp(world);
    const path = await s.assignedPath();
    valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, 0, right));
    valueOf(await s.submit(s.tokenOf(s.ana.id), path.id, 0, [0, 0, 0]));

    const cls = valueOf(
      await new GetClassLearning(world).execute({ actor: s.actor, classId: s.cls.id }),
    );
    expect(cls.students.map((row) => row.firstName)).toEqual(['Ben', 'Cara', 'Ana']);
    expect(cls.students.find((row) => row.studentId === s.ben.id)).toMatchObject({
      done: 0,
      total: 0,
      average: null,
    });
    expect(cls.drafts).toEqual([]);

    const student = valueOf(
      await new GetStudentLearning(world).execute({ actor: s.actor, studentId: s.ana.id }),
    );
    expect(student.subjects).toEqual([
      expect.objectContaining({ subject: 'math', done: 1, total: 3, average: 100, level: 3 }),
    ]);
    expect(student.paths[0]?.progress.lessons[0]).toEqual({ done: true, best: 100, attempts: 2 });

    const other = await signedUp(world, 'other@school.edu');
    expect(
      await new GetStudentLearning(world).execute({ actor: other.user, studentId: s.ana.id }),
    ).toEqual(notFound);
    expect(
      await new GetClassLearning(world).execute({ actor: colleagueOf(s.actor), classId: s.cls.id }),
    ).toEqual(forbidden);
  });
});
