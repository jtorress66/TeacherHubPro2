import { describe, expect, it } from 'vitest';
import {
  type AssignmentId,
  type ClassId,
  type GradeCategoryId,
  type GradeId,
  type QuestionId,
  type SchoolId,
  type StudentId,
  type UserId,
} from '../shared/ids.ts';
import { valueOf } from '../test-support.ts';
import { createAssignment, type Assignment } from './assignment.ts';
import { classGradeReport } from './class-grade-report.ts';
import { createGrade, type Grade, type GradeStatus } from './grade.ts';
import { createGradeCategory, type GradeCategory } from './grade-category.ts';
import { letterGrade } from './letter-grade.ts';
import { createQuestion } from './question.ts';
import { studentGradeSummary } from './student-grades.ts';

const schoolId = 'school-1' as SchoolId;
const classId = 'class-1' as ClassId;
const ana = 'ana' as StudentId;
const ben = 'ben' as StudentId;
const cruz = 'cruz' as StudentId;

const category = (id: string, weightPercent: number): GradeCategory =>
  valueOf(
    createGradeCategory({ id: id as GradeCategoryId, schoolId, classId, name: id, weightPercent }),
  );

const assignment = (id: string, categoryId: string, points: number): Assignment =>
  valueOf(
    createAssignment({
      id: id as AssignmentId,
      schoolId,
      classId,
      categoryId: categoryId as GradeCategoryId,
      title: id,
      points,
    }),
  );

const grade = (
  studentId: StudentId,
  on: Assignment,
  status: GradeStatus,
  score: number | null = null,
): Grade =>
  valueOf(
    createGrade({
      id: `${studentId}-${on.id}` as GradeId,
      schoolId,
      studentId,
      assignmentId: on.id,
      status,
      score,
      maxPoints: on.points,
      source: 'manual',
      gradedBy: 'teacher-1' as UserId,
    }),
  );

describe('letterGrade', () => {
  it('uses the report card bands: A from 90, B from 80, C from 70, D from 60, else F', () => {
    expect([100, 90, 89.99, 80, 79.9, 70, 69.5, 60, 59.9, 0].map(letterGrade)).toEqual([
      'A',
      'A',
      'B',
      'B',
      'C',
      'C',
      'D',
      'D',
      'F',
      'F',
    ]);
  });
});

describe('studentGradeSummary', () => {
  const tests = category('tests', 50);
  const homework = category('homework', 30);
  const projects = category('projects', 20);
  const exam = assignment('exam', 'tests', 50);
  const hw1 = assignment('hw1', 'homework', 10);
  const hw2 = assignment('hw2', 'homework', 10);
  const poster = assignment('poster', 'projects', 20);

  it('reproduces recorded example 1: weighted over the categories with grades', () => {
    const summary = studentGradeSummary(
      [tests, homework, projects],
      [exam, hw1, hw2, poster],
      [grade(ana, exam, 'graded', 45), grade(ana, hw1, 'graded', 7), grade(ana, hw2, 'late', 9)],
    );

    expect(summary.overall).toBeCloseTo(86.25, 10);
    expect(summary.gpa).toBeCloseTo(3.625, 10);
    expect(summary.letter).toBe('B');
    expect(summary.categories).toEqual([
      { categoryId: tests.id, earned: 45, possible: 50, percentage: 90, count: 1 },
      { categoryId: homework.id, earned: 16, possible: 20, percentage: 80, count: 2 },
    ]);
    expect(summary).toMatchObject({ earned: 61, possible: 70, completed: 3 });
  });

  it('reproduces recorded example 2: excused and pending left out, missing counts as 0', () => {
    const only = category('homework', 100);
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => assignment(id, 'homework', 10)) as [
      Assignment,
      Assignment,
      Assignment,
      Assignment,
    ];
    const summary = studentGradeSummary(
      [only],
      [a, b, c, d],
      [
        grade(ana, a, 'graded', 10),
        grade(ana, b, 'excused'),
        grade(ana, c, 'pending'),
        grade(ana, d, 'missing'),
      ],
    );

    expect(summary).toMatchObject({ overall: 50, earned: 10, possible: 20, completed: 1 });
    expect(summary.gpa).toBeCloseTo(0.8333, 3);
    expect(summary.letter).toBe('F');
  });

  it('reproduces recorded example 3: the questions set the maximum', () => {
    const only = category('tests', 100);
    const questions = ['q1', 'q2', 'q3'].map((id) =>
      valueOf(
        createQuestion({ type: 'essay', id: id as QuestionId, prompt: 'Explain', points: 10 }),
      ),
    );
    const quiz = valueOf(
      createAssignment({
        id: 'quiz' as AssignmentId,
        schoolId,
        classId,
        categoryId: only.id,
        title: 'Quiz',
        points: 100,
        questions,
      }),
    );
    const scored = valueOf(
      createGrade({
        id: 'g' as GradeId,
        schoolId,
        studentId: ana,
        assignmentId: quiz.id,
        status: 'graded',
        score: 24,
        maxPoints: 30,
        source: 'manual',
        gradedBy: 'teacher-1' as UserId,
      }),
    );

    expect(studentGradeSummary([only], [quiz], [scored])).toMatchObject({
      overall: 80,
      gpa: 3,
      letter: 'B',
      possible: 30,
    });
  });

  it('ignores grades for assignments that are not given, and an ungraded student has no overall', () => {
    const other = assignment('other', 'tests', 10);

    expect(studentGradeSummary([tests], [exam], [grade(ana, other, 'graded', 0)])).toEqual({
      categories: [],
      overall: null,
      gpa: null,
      letter: null,
      earned: 0,
      possible: 0,
      completed: 0,
    });
  });

  it('counts categories equally when every weight is 0', () => {
    const a = category('a', 0);
    const b = category('b', 0);
    const onA = assignment('on-a', 'a', 10);
    const onB = assignment('on-b', 'b', 10);

    expect(
      studentGradeSummary(
        [a, b],
        [onA, onB],
        [grade(ana, onA, 'graded', 9), grade(ana, onB, 'graded', 6)],
      ).overall,
    ).toBe(75);
  });
});

describe('classGradeReport', () => {
  const only = category('tests', 100);
  const exam = assignment('exam', 'tests', 10);

  it('averages the students that have an overall and counts each letter', () => {
    const report = classGradeReport(
      [only],
      [exam],
      [grade(ana, exam, 'graded', 10), grade(ben, exam, 'graded', 7), grade(cruz, exam, 'excused')],
      [ana, ben, cruz],
    );

    expect(report.students.map((row) => [row.studentId, row.summary.overall])).toEqual([
      ['ana', 100],
      ['ben', 70],
      ['cruz', null],
    ]);
    expect(report.average).toBe(85);
    expect(report.gpa).toBe(3.5);
    expect(report.letter).toBe('B');
    expect(report.distribution).toEqual({ A: 1, B: 0, C: 1, D: 0, F: 0 });
  });

  it('has no average when nobody has a counted grade', () => {
    const report = classGradeReport([only], [exam], [], [ana]);

    expect(report).toMatchObject({ average: null, gpa: null, letter: null });
    expect(report.distribution).toEqual({ A: 0, B: 0, C: 0, D: 0, F: 0 });
  });
});
