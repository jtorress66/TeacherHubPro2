import { describe, expect, it } from 'vitest';
import {
  type AssignmentId,
  type ClassId,
  type GradeCategoryId,
  type QuestionId,
  type SchoolId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createAssignment, maxPoints } from './assignment.ts';
import { createGradeCategory } from './grade-category.ts';
import { createQuestion } from './question.ts';

const schoolId = 'school-1' as SchoolId;
const classId = 'class-1' as ClassId;
const base = {
  id: 'a1' as AssignmentId,
  schoolId,
  classId,
  categoryId: 'cat-1' as GradeCategoryId,
  title: 'Quiz 1',
};
const question = (id: string, points: number) =>
  valueOf(createQuestion({ type: 'short_answer', id: id as QuestionId, prompt: 'Why?', points }));

describe('createAssignment', () => {
  it('defaults to 100 points, no due date and no questions', () => {
    expect(valueOf(createAssignment(base))).toEqual({
      ...base,
      points: 100,
      dueDate: null,
      questions: [],
    });
  });

  it('keeps a due date and questions', () => {
    const assignment = valueOf(
      createAssignment({ ...base, dueDate: '2026-09-18', questions: [question('q1', 4)] }),
    );
    expect(assignment.dueDate).toBe('2026-09-18');
    expect(assignment.questions).toHaveLength(1);
  });

  it('rejects a blank title, non-positive points, a bad due date and repeated question ids', () => {
    expect(errorOf(createAssignment({ ...base, title: '' }))).toEqual({
      field: 'title',
      code: 'required',
    });
    expect(errorOf(createAssignment({ ...base, points: 0 }))).toEqual({
      field: 'points',
      code: 'out_of_range',
    });
    expect(errorOf(createAssignment({ ...base, dueDate: 'Friday' }))).toEqual({
      field: 'dueDate',
      code: 'invalid_format',
    });
    expect(
      errorOf(createAssignment({ ...base, questions: [question('q1', 1), question('q1', 2)] })),
    ).toEqual({ field: 'questions', code: 'duplicate' });
  });
});

describe('maxPoints', () => {
  it('max is the sum of question points', () => {
    const assignment = valueOf(
      createAssignment({
        ...base,
        points: 100,
        questions: [question('q1', 10), question('q2', 5)],
      }),
    );
    expect(maxPoints(assignment)).toBe(15);
  });

  it('falls back to points with no questions', () => {
    expect(maxPoints(valueOf(createAssignment({ ...base, points: 40 })))).toBe(40);
  });
});

describe('createGradeCategory', () => {
  const input = { id: 'cat-1' as GradeCategoryId, schoolId, classId, name: 'Tests' };

  it('defaults the weight to 100%', () => {
    expect(valueOf(createGradeCategory(input))).toEqual({ ...input, weightPercent: 100 });
  });

  it('accepts weights from 0 to 100 and rejects others', () => {
    expect(valueOf(createGradeCategory({ ...input, weightPercent: 0 })).weightPercent).toBe(0);
    expect(valueOf(createGradeCategory({ ...input, weightPercent: 37.5 })).weightPercent).toBe(
      37.5,
    );
    for (const weightPercent of [-1, 101, Number.NaN]) {
      expect(errorOf(createGradeCategory({ ...input, weightPercent }))).toEqual({
        field: 'weightPercent',
        code: 'out_of_range',
      });
    }
  });

  it('rejects a blank name', () => {
    expect(errorOf(createGradeCategory({ ...input, name: ' ' }))).toEqual({
      field: 'name',
      code: 'required',
    });
  });
});
