import type { ClassId, ReportCardCommentId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, type ValidationError } from '../shared/validation.ts';

export const maxCommentLength = 1000;

/** The teacher's comment on a student's report card for one class (and so one semester). */
export interface ReportCardComment {
  readonly id: ReportCardCommentId;
  readonly schoolId: SchoolId;
  readonly classId: ClassId;
  readonly studentId: StudentId;
  readonly text: string;
  readonly writtenBy: UserId;
}

export interface ReportCardCommentInput extends Omit<ReportCardComment, 'text'> {
  readonly text: string;
}

/** The trimmed comment, or null when it is blank (no comment). */
export function writeReportCardComment(
  input: ReportCardCommentInput,
): Result<ReportCardComment | null, ValidationError> {
  const text = optionalText('comment', input.text, maxCommentLength);
  if (!text.ok) return text;
  return ok(text.value === null ? null : { ...input, text: text.value });
}
