import { describe, expect, it } from 'vitest';
import { parseAssignmentForm, parseCategoryForm, parseGradeForm } from './grade-forms.ts';

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

const base = { locale: 'es', classId: 'class-1', assignmentId: 'quiz-1' };

describe('grade entry form', () => {
  it('reads one row per student: a score is graded unless marked late, blank is pending', () => {
    const parsed = parseGradeForm(
      form({
        ...base,
        'status.s1': '',
        'score.s1': '8.5',
        'comment.s1': '  Bien ',
        'status.s2': '',
        'score.s2': ' ',
        'status.s3': 'late',
        'score.s3': '7',
        'status.s4': 'missing',
        'score.s4': '9',
        'status.s5': 'excused',
      }),
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        locale: 'es',
        classId: 'class-1',
        assignmentId: 'quiz-1',
        rows: [
          { studentId: 's1', status: 'graded', score: 8.5, comment: 'Bien' },
          { studentId: 's2', status: 'pending', score: null, comment: null },
          { studentId: 's3', status: 'late', score: 7, comment: null },
          { studentId: 's4', status: 'missing', score: null, comment: null },
          { studentId: 's5', status: 'excused', score: null, comment: null },
        ],
      },
    });
  });

  it('reports a bad score, an unknown status and an over-long comment under the field', () => {
    const parsed = parseGradeForm(
      form({
        ...base,
        'status.s1': '',
        'score.s1': 'ten',
        'status.s2': 'asleep',
        'status.s3': 'graded',
        'score.s3': '-1',
        'status.s4': '',
        'comment.s4': 'x'.repeat(2001),
      }),
    );

    expect(parsed).toEqual({
      ok: false,
      error: {
        'score.s1': 'invalid_format',
        'status.s2': 'invalid_format',
        'score.s3': 'invalid_format',
        'comment.s4': 'too_long',
      },
    });
  });
});

describe('category form', () => {
  it('reads a name and weight, keeping a blank or non-numeric weight for the domain to refuse', () => {
    expect(
      parseCategoryForm(form({ ...base, categoryId: 'c1', name: 'Labs', weightPercent: '12.5' })),
    ).toEqual({
      locale: 'es',
      classId: 'class-1',
      categoryId: 'c1',
      details: { name: 'Labs', weightPercent: 12.5 },
    });
    expect(
      parseCategoryForm(form({ locale: 'xx', classId: 'c', name: 'A', weightPercent: '' })).details,
    ).toEqual({ name: 'A', weightPercent: Number.NaN });
  });
});

describe('assignment form', () => {
  it('reads title, category, points and an optional due date', () => {
    expect(
      parseAssignmentForm(
        form({
          ...base,
          title: 'Quiz 1',
          categoryId: 'c1',
          points: '20',
          dueDate: '2026-09-18',
        }),
      ),
    ).toEqual({
      locale: 'es',
      classId: 'class-1',
      assignmentId: 'quiz-1',
      details: { title: 'Quiz 1', categoryId: 'c1', points: 20, dueDate: '2026-09-18' },
    });
    expect(
      parseAssignmentForm(
        form({ classId: 'c', title: 'T', categoryId: 'c1', points: '', dueDate: '' }),
      ).details,
    ).toEqual({ title: 'T', categoryId: 'c1', points: Number.NaN, dueDate: null });
  });
});
