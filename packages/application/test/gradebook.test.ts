import { describe, expect, it } from 'vitest';
import type { GradeCategoryId, User } from '@thp/domain';
import {
  AddGradeCategory,
  AddStandardCategories,
  AddStudent,
  ArchiveClass,
  CreateAssignment,
  CreateClass,
  DeleteAssignment,
  DeleteGradeCategory,
  GetGradebook,
  GetGradebookReport,
  GetGradeEntry,
  ListAssignments,
  ListGradeCategories,
  SaveGrades,
  UpdateAssignment,
  UpdateGradeCategory,
} from '../src/index.ts';
import { colleagueOf, gradedClass, standardNames, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

describe('grade categories', () => {
  it('starts a class with the standard categories in the teacher’s language, only once', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);

    const listed = valueOf(
      await new ListGradeCategories(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(listed.map((c) => [c.name, c.weightPercent])).toEqual([
      ['Tareas', 25],
      ['Pruebas cortas', 25],
      ['Exámenes', 30],
      ['Proyectos', 20],
    ]);
    expect(
      await new AddStandardCategories(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        names: standardNames,
      }),
    ).toEqual({ ok: false, error: { code: 'categories_exist' } });
  });

  it('adds, renames and reweights a category with the domain rules', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const { actor, cls } = room;

    const added = valueOf(
      await new AddGradeCategory(world).execute({
        actor,
        classId: cls.id,
        details: { name: 'Laboratorio', weightPercent: 10 },
      }),
    );
    expect(
      await new AddGradeCategory(world).execute({
        actor,
        classId: cls.id,
        details: { name: 'X', weightPercent: 150 },
      }),
    ).toEqual({ ok: false, error: { field: 'weightPercent', code: 'out_of_range' } });

    const updated = valueOf(
      await new UpdateGradeCategory(world).execute({
        actor,
        classId: cls.id,
        categoryId: added.id,
        details: { name: 'Lab', weightPercent: 15 },
      }),
    );
    expect(updated).toMatchObject({ id: added.id, name: 'Lab', weightPercent: 15 });
    expect(
      await new UpdateGradeCategory(world).execute({
        actor,
        classId: cls.id,
        categoryId: 'nope' as GradeCategoryId,
        details: { name: 'Lab' },
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('refuses to delete a category that still has assignments', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    await room.assign('Quiz 1', 'Pruebas cortas', 10);
    const remove = (name: string) =>
      new DeleteGradeCategory(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        categoryId: room.category(name),
      });

    expect(await remove('Pruebas cortas')).toEqual({
      ok: false,
      error: { code: 'category_in_use' },
    });
    expect(await remove('Proyectos')).toEqual({ ok: true, value: true });
    const left = valueOf(
      await new ListGradeCategories(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(left.map((c) => c.name)).not.toContain('Proyectos');
  });
});

describe('assignments', () => {
  it('lists assignments by due date, undated last, and refuses a category from another class', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    await room.assign('Proyecto', 'Proyectos', 20);
    await room.assign('Examen 1', 'Exámenes', 50, '2026-09-20');
    await room.assign('Tarea 1', 'Tareas', 10, '2026-09-10');
    const other = valueOf(
      await new CreateClass(world).execute({ actor: room.actor, details: { name: 'Otra' } }),
    );
    const otherCategory = valueOf(
      await new AddGradeCategory(world).execute({
        actor: room.actor,
        classId: other.id,
        details: { name: 'Otra' },
      }),
    );

    const listed = valueOf(
      await new ListAssignments(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(listed.map((a) => a.title)).toEqual(['Tarea 1', 'Examen 1', 'Proyecto']);
    expect(
      await new CreateAssignment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        details: { title: 'X', categoryId: otherCategory.id, points: 10 },
      }),
    ).toEqual({ ok: false, error: { field: 'categoryId', code: 'not_allowed' } });
  });

  it('edits an assignment, keeping its grades', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    await room.grade(quiz.id, [{ studentId: room.ana.id, status: 'graded', score: 8 }]);

    const updated = valueOf(
      await new UpdateAssignment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
        details: { title: 'Quiz A', categoryId: room.category('Exámenes'), points: 20 },
      }),
    );
    expect(updated).toMatchObject({ title: 'Quiz A', points: 20 });
    expect(await world.grades.listByAssignment(room.cls.schoolId, quiz.id)).toHaveLength(1);
  });

  it('deletes an assignment together with its grades', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    await room.grade(quiz.id, [{ studentId: room.ana.id, status: 'graded', score: 8 }]);

    expect(
      await new DeleteAssignment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
      }),
    ).toEqual({ ok: true, value: true });
    expect(await world.assignments.findById(room.cls.schoolId, quiz.id)).toBeNull();
    expect(await world.grades.listByAssignment(room.cls.schoolId, quiz.id)).toEqual([]);
  });
});

describe('grade entry', () => {
  it('shows every student, in name order, with any saved grade', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    await room.grade(quiz.id, [{ studentId: room.ana.id, status: 'graded', score: 9 }]);

    const entry = valueOf(
      await new GetGradeEntry(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
      }),
    );
    expect(entry.assignment.title).toBe('Quiz');
    expect(entry.maxPoints).toBe(10);
    expect(entry.editable).toBe(true);
    expect(entry.rows.map((r) => [r.student.lastName, r.grade?.score ?? null])).toEqual([
      ['Acosta', null],
      ['Morales', null],
      ['Zayas', 9],
    ]);
  });

  it('saves a whole column, then updates the same grades on the next save', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);

    const first = await room.grade(quiz.id, [
      { studentId: room.ana.id, status: 'graded', score: 8 },
      { studentId: room.ben.id, status: 'missing' },
      { studentId: room.cara.id, status: 'excused' },
    ]);
    const second = await room.grade(quiz.id, [
      { studentId: room.ana.id, status: 'late', score: 7 },
    ]);

    const saved = await world.grades.listByAssignment(room.cls.schoolId, quiz.id);
    expect(saved).toHaveLength(3);
    const ana = saved.find((g) => g.studentId === room.ana.id);
    expect(ana).toMatchObject({
      status: 'late',
      score: 7,
      source: 'manual',
      gradedBy: room.actor.id,
    });
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  it('saves nothing when any row is invalid, and reports every bad row by student', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);

    const result = await new SaveGrades(world).execute({
      actor: room.actor,
      classId: room.cls.id,
      assignmentId: quiz.id,
      rows: [
        { studentId: room.ana.id, status: 'graded', score: 8 },
        { studentId: room.ben.id, status: 'graded' },
        { studentId: room.cara.id, status: 'graded', score: 11 },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid_grades',
        rows: { [room.ben.id]: 'out_of_range', [room.cara.id]: 'out_of_range' },
      },
    });
    expect(await world.grades.listByAssignment(room.cls.schoolId, quiz.id)).toEqual([]);
  });

  it('refuses a student who is not in the class, and an assignment of another class', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    const other = valueOf(
      await new CreateClass(world).execute({ actor: room.actor, details: { name: 'Otra' } }),
    );
    const stranger = valueOf(
      await new AddStudent(world).execute({
        actor: room.actor,
        classId: other.id,
        details: { firstName: 'Eva', lastName: 'Ríos' },
      }),
    );

    expect(
      await new SaveGrades(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
        rows: [{ studentId: stranger.id, status: 'graded', score: 5 }],
      }),
    ).toEqual({
      ok: false,
      error: { code: 'invalid_grades', rows: { [stranger.id]: 'not_allowed' } },
    });
    expect(
      await new GetGradeEntry(world).execute({
        actor: room.actor,
        classId: other.id,
        assignmentId: quiz.id,
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('gradebook and report', () => {
  /** Example 1 for Ana; Ben scores 70% on the test only; Cara has nothing counted. */
  async function recorded(world: World) {
    const room = await gradedClass(world);
    for (const [name, weightPercent] of [
      ['Exámenes', 50],
      ['Tareas', 30],
      ['Proyectos', 20],
    ] as const) {
      valueOf(
        await new UpdateGradeCategory(world).execute({
          actor: room.actor,
          classId: room.cls.id,
          categoryId: room.category(name),
          details: { name, weightPercent },
        }),
      );
    }
    const test = await room.assign('Examen', 'Exámenes', 50);
    const hw1 = await room.assign('Tarea 1', 'Tareas', 10);
    const hw2 = await room.assign('Tarea 2', 'Tareas', 10);
    await room.grade(test.id, [
      { studentId: room.ana.id, status: 'graded', score: 45 },
      { studentId: room.ben.id, status: 'graded', score: 35 },
      { studentId: room.cara.id, status: 'excused' },
    ]);
    await room.grade(hw1.id, [{ studentId: room.ana.id, status: 'graded', score: 7 }]);
    await room.grade(hw2.id, [{ studentId: room.ana.id, status: 'late', score: 9 }]);
    return { ...room, test, hw1, hw2 };
  }

  it('builds the grid with each student’s weighted overall (recorded example 1)', async () => {
    const world = makeWorld();
    const room = await recorded(world);

    const book = valueOf(
      await new GetGradebook(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(book.categories).toHaveLength(4);
    expect(book.assignments.map((a) => a.title)).toEqual(['Examen', 'Tarea 1', 'Tarea 2']);
    const zayas = book.rows.find((r) => r.student.id === room.ana.id);
    expect(zayas?.summary.overall).toBeCloseTo(86.25, 10);
    expect(zayas?.grades[room.hw2.id]?.status).toBe('late');
    expect(book.rows.map((r) => r.student.lastName)).toEqual(['Acosta', 'Morales', 'Zayas']);
    expect(book.totalWeight).toBe(125); // quizzes keep their 25
  });

  it('reports the class average, GPA and letter distribution over graded students', async () => {
    const world = makeWorld();
    const room = await recorded(world);

    const report = valueOf(
      await new GetGradebookReport(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(report.average).toBeCloseTo((86.25 + 70) / 2, 10);
    expect(report.distribution).toEqual({ A: 0, B: 1, C: 1, D: 0, F: 0 });
    expect(report.assignments).toBe(3);
    expect(report.rows.map((r) => [r.student.lastName, r.summary.letter])).toEqual([
      ['Acosta', 'C'],
      ['Morales', null],
      ['Zayas', 'B'],
    ]);
  });
});

describe('gradebook access', () => {
  it('lets an admin of the school grade, and keeps an archived class read-only', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    const admin = colleagueOf(room.actor, 'school_admin');

    expect(
      (
        await new SaveGrades(world).execute({
          actor: admin,
          classId: room.cls.id,
          assignmentId: quiz.id,
          rows: [{ studentId: room.ana.id, status: 'graded', score: 10 }],
        })
      ).ok,
    ).toBe(true);

    await new ArchiveClass(world).execute({ actor: room.actor, classId: room.cls.id });
    const archived = { ok: false, error: { code: 'class_archived' } };
    expect(
      await new SaveGrades(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
        rows: [],
      }),
    ).toEqual(archived);
    expect(
      await new AddGradeCategory(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        details: { name: 'Lab' },
      }),
    ).toEqual(archived);
    expect(
      await new DeleteAssignment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
      }),
    ).toEqual(archived);
    const entry = valueOf(
      await new GetGradeEntry(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        assignmentId: quiz.id,
      }),
    );
    expect(entry.editable).toBe(false);
  });

  it("refuses another teacher, and another school's class is unreachable, for every use case", async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const quiz = await room.assign('Quiz', 'Pruebas cortas', 10);
    const other = await signedUp(world, 'ben@other.edu');
    const classId = room.cls.id;
    const categoryId = room.category('Tareas');
    const assignmentId = quiz.id;
    const attempts = (actor: User) => [
      new ListGradeCategories(world).execute({ actor, classId }),
      new AddGradeCategory(world).execute({ actor, classId, details: { name: 'X' } }),
      new AddStandardCategories(world).execute({ actor, classId, names: standardNames }),
      new UpdateGradeCategory(world).execute({
        actor,
        classId,
        categoryId,
        details: { name: 'X' },
      }),
      new DeleteGradeCategory(world).execute({ actor, classId, categoryId }),
      new ListAssignments(world).execute({ actor, classId }),
      new CreateAssignment(world).execute({
        actor,
        classId,
        details: { title: 'X', categoryId, points: 1 },
      }),
      new UpdateAssignment(world).execute({
        actor,
        classId,
        assignmentId,
        details: { title: 'X', categoryId, points: 1 },
      }),
      new DeleteAssignment(world).execute({ actor, classId, assignmentId }),
      new GetGradeEntry(world).execute({ actor, classId, assignmentId }),
      new SaveGrades(world).execute({ actor, classId, assignmentId, rows: [] }),
      new GetGradebook(world).execute({ actor, classId }),
      new GetGradebookReport(world).execute({ actor, classId }),
    ];

    for (const result of await Promise.all(attempts(colleagueOf(room.actor)))) {
      expect(result).toEqual({ ok: false, error: { code: 'forbidden' } });
    }
    for (const result of await Promise.all(attempts(other.user))) {
      expect(result).toEqual({ ok: false, error: { code: 'not_found' } });
    }
  });
});
