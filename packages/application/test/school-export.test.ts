import { describe, expect, it } from 'vitest';
import type { QuestionId } from '@thp/domain';
import {
  ArchiveClass,
  CreateSampleClass,
  ExportSchoolData,
  IssueLinks,
  SaveQuestions,
  SubmitAnswers,
  SubmitAttendance,
} from '../src/index.ts';
import { sampleText } from './sample-text.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

type Room = Awaited<ReturnType<typeof gradedClass>>;

/** A class with a graded assignment, a day of attendance and one handed-in answer. */
async function busyClass(world: World, email?: string): Promise<Room> {
  const room = await gradedClass(world, email);
  const quiz = await room.assign('Quiz 1', 'Pruebas cortas', 10, '2026-09-10');
  await room.grade(quiz.id, [
    { studentId: room.ana.id, status: 'graded', score: 9 },
    { studentId: room.ben.id, status: 'missing' },
  ]);
  valueOf(
    await new SubmitAttendance(world).execute({
      actor: room.actor,
      classId: room.cls.id,
      date: '2026-09-01',
      marks: [
        { studentId: room.ana.id, status: 'present' },
        { studentId: room.ben.id, status: 'tardy', minutesLate: 5 },
        { studentId: room.cara.id, status: 'absent' },
      ],
    }),
  );
  valueOf(
    await new SaveQuestions(world).execute({
      actor: room.actor,
      classId: room.cls.id,
      assignmentId: quiz.id,
      questions: [
        { id: 'q1' as QuestionId, type: 'short_answer', prompt: 'Why day and night?', points: 10 },
      ],
    }),
  );
  const links = valueOf(
    await new IssueLinks(world).execute({ actor: room.actor, classId: room.cls.id }),
  );
  const anaLink = links.find((link) => link.student.id === room.ana.id);
  if (anaLink === undefined) throw new Error('no link for Ana');
  valueOf(
    await new SubmitAnswers(world).execute({
      token: anaLink.token,
      assignmentId: quiz.id,
      answers: { q1: 'The Earth turns.' },
    }),
  );
  return room;
}

describe('ExportSchoolData', () => {
  it('gives the owner every table of their school', async () => {
    const world = makeWorld();
    const room = await busyClass(world);

    const data = valueOf(await new ExportSchoolData(world).execute({ actor: room.actor }));

    expect(data.teachers).toEqual([
      { name: 'Ana López', email: 'ana@school.edu', role: 'teacher' },
    ]);
    expect(data.classes).toEqual([
      {
        name: 'Ciencias 5',
        teacher: 'Ana López',
        subject: null,
        grade: null,
        section: null,
        schoolYear: null,
        archived: false,
      },
    ]);
    expect(data.students.map((s) => s.student)).toEqual([
      'Ben Acosta',
      'Cara Morales',
      'Ana Zayas',
    ]);
    expect(data.students[0]).toEqual({
      className: 'Ciencias 5',
      student: 'Ben Acosta',
      firstName: 'Ben',
      lastName: 'Acosta',
      studentNumber: null,
      parentEmail: null,
      accommodations: null,
    });
    expect(data.assignments).toEqual([
      {
        className: 'Ciencias 5',
        title: 'Quiz 1',
        category: 'Pruebas cortas',
        points: 10,
        dueDate: '2026-09-10',
      },
    ]);
    expect(data.grades).toEqual([
      {
        className: 'Ciencias 5',
        student: 'Ben Acosta',
        assignment: 'Quiz 1',
        status: 'missing',
        score: null,
        comment: null,
      },
      {
        className: 'Ciencias 5',
        student: 'Ana Zayas',
        assignment: 'Quiz 1',
        status: 'graded',
        score: 9,
        comment: null,
      },
    ]);
    expect(data.attendance).toEqual([
      {
        className: 'Ciencias 5',
        student: 'Ben Acosta',
        date: '2026-09-01',
        status: 'tardy',
        minutesLate: 5,
        note: null,
      },
      expect.objectContaining({ student: 'Cara Morales', status: 'absent' }),
      expect.objectContaining({ student: 'Ana Zayas', status: 'present' }),
    ]);
    expect(data.answers).toEqual([
      {
        className: 'Ciencias 5',
        student: 'Ana Zayas',
        assignment: 'Quiz 1',
        question: 1,
        prompt: 'Why day and night?',
        answer: 'The Earth turns.',
        submittedAt: world.clock.now(),
        late: false,
      },
    ]);
  });

  it('keeps archived classes and leaves out the made-up sample class', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    valueOf(await new ArchiveClass(world).execute({ actor: room.actor, classId: room.cls.id }));
    await new CreateSampleClass(world).execute({
      actor: room.actor,
      text: sampleText,
      timeZone: 'UTC',
    });

    const data = valueOf(await new ExportSchoolData(world).execute({ actor: room.actor }));

    expect(data.classes.map((c) => [c.name, c.archived])).toEqual([['Ciencias 5', true]]);
    expect(new Set(data.students.map((s) => s.className))).toEqual(new Set(['Ciencias 5']));
    expect(data.attendance).toEqual([]);
  });

  it('never includes another school’s data', async () => {
    const world = makeWorld();
    const mine = await gradedClass(world);
    const theirs = await busyClass(world, 'bo@other.edu');
    expect(theirs.actor.schoolId).not.toBe(mine.actor.schoolId);

    const data = valueOf(await new ExportSchoolData(world).execute({ actor: mine.actor }));

    expect(data.teachers.map((t) => t.email)).toEqual(['ana@school.edu']);
    expect(data.classes).toHaveLength(1);
    expect(data.students).toHaveLength(3);
    expect(data.assignments).toEqual([]);
    expect(data.grades).toEqual([]);
    expect(data.attendance).toEqual([]);
    expect(data.answers).toEqual([]);
  });

  it('is open to the school’s admins and refused to its other teachers', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const admin = colleagueOf(room.actor, 'school_admin');
    const teacher = colleagueOf(room.actor, 'teacher');
    await world.users.save(admin);
    await world.users.save(teacher);
    const exporter = new ExportSchoolData(world);

    expect(await exporter.isOpenTo(room.actor)).toBe(true);
    expect(await exporter.isOpenTo(admin)).toBe(true);
    expect(await exporter.isOpenTo(teacher)).toBe(false);
    expect((await exporter.execute({ actor: admin })).ok).toBe(true);
    expect(await exporter.execute({ actor: teacher })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('records who downloaded the data, by ID only', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);

    valueOf(await new ExportSchoolData(world).execute({ actor: room.actor }));

    expect(world.auditLog.events).toEqual([
      expect.objectContaining({
        schoolId: room.actor.schoolId,
        actorId: room.actor.id,
        action: 'school_data_exported',
        targetId: null,
        at: world.clock.now(),
      }),
    ]);
  });
});
