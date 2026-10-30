import { describe, expect, it } from 'vitest';
import {
  type ClassId,
  type ReportCardCommentId,
  type SchoolId,
  type StudentId,
  type UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { maxCommentLength, writeReportCardComment } from './report-card-comment.ts';

const input = {
  id: 'comment-1' as ReportCardCommentId,
  schoolId: 'school-1' as SchoolId,
  classId: 'class-1' as ClassId,
  studentId: 'student-1' as StudentId,
  writtenBy: 'teacher-1' as UserId,
};

describe('writeReportCardComment', () => {
  it('keeps the trimmed text', () => {
    expect(valueOf(writeReportCardComment({ ...input, text: '  Great effort. ' }))).toEqual({
      ...input,
      text: 'Great effort.',
    });
  });

  it('a blank comment means there is none', () => {
    expect(valueOf(writeReportCardComment({ ...input, text: '   ' }))).toBeNull();
  });

  it(`refuses more than ${String(maxCommentLength)} characters`, () => {
    expect(
      valueOf(writeReportCardComment({ ...input, text: 'x'.repeat(1000) }))?.text,
    ).toHaveLength(1000);
    expect(errorOf(writeReportCardComment({ ...input, text: 'x'.repeat(1001) }))).toEqual({
      field: 'comment',
      code: 'too_long',
    });
  });
});
