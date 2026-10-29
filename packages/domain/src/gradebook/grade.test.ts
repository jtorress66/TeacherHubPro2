import { describe, expect, it } from 'vitest';
import {
  type AssignmentId,
  type GradeId,
  type SchoolId,
  type StudentId,
  type UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { createGrade } from './grade.ts';

const base = {
  id: 'g1' as GradeId,
  schoolId: 'school-1' as SchoolId,
  studentId: 'student-1' as StudentId,
  assignmentId: 'a1' as AssignmentId,
  gradedBy: 'teacher-1' as UserId,
  maxPoints: 20,
  source: 'manual' as const,
};

describe('createGrade', () => {
  it('records a graded score within the maximum', () => {
    expect(valueOf(createGrade({ ...base, status: 'graded', score: 17 }))).toEqual({
      id: base.id,
      schoolId: base.schoolId,
      studentId: base.studentId,
      assignmentId: base.assignmentId,
      gradedBy: base.gradedBy,
      source: 'manual',
      status: 'graded',
      score: 17,
      comment: null,
    });
  });

  it('accepts 0 and the full maximum, and a late score', () => {
    expect(valueOf(createGrade({ ...base, status: 'graded', score: 0 })).score).toBe(0);
    expect(
      valueOf(createGrade({ ...base, status: 'late', score: 20, comment: ' 2 days late ' })),
    ).toMatchObject({
      score: 20,
      comment: '2 days late',
    });
  });

  it('rejects a graded or late grade without a score, or with a score outside 0..max', () => {
    for (const score of [undefined, null, -1, 21, Number.NaN]) {
      expect(errorOf(createGrade({ ...base, status: 'graded', score }))).toEqual({
        field: 'score',
        code: 'out_of_range',
      });
    }
    expect(errorOf(createGrade({ ...base, status: 'late' }))).toEqual({
      field: 'score',
      code: 'out_of_range',
    });
  });

  it('missing, excused and pending grades carry no score', () => {
    for (const status of ['missing', 'excused', 'pending'] as const) {
      expect(valueOf(createGrade({ ...base, status })).score).toBeNull();
      expect(errorOf(createGrade({ ...base, status, score: 5 }))).toEqual({
        field: 'score',
        code: 'invalid_format',
      });
    }
  });

  it('rejects an over-long comment', () => {
    expect(
      errorOf(createGrade({ ...base, status: 'graded', score: 1, comment: 'c'.repeat(2001) })),
    ).toEqual({
      field: 'comment',
      code: 'too_long',
    });
  });

  it('records grades confirmed from an AI draft', () => {
    expect(
      valueOf(createGrade({ ...base, source: 'confirmed_ai', status: 'graded', score: 9 })).source,
    ).toBe('confirmed_ai');
  });
});
