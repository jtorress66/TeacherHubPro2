import type { AssignmentId, GradeId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';

export type GradeStatus = 'pending' | 'graded' | 'late' | 'missing' | 'excused';

/**
 * Who decided the grade. Every Grade is a teacher decision: AI scores live on the
 * submission as drafts until a teacher confirms them.
 */
export type GradeSource = 'manual' | 'confirmed_ai';

/** The one grade a student has for an assignment. */
export interface Grade {
  readonly id: GradeId;
  readonly schoolId: SchoolId;
  readonly studentId: StudentId;
  readonly assignmentId: AssignmentId;
  readonly status: GradeStatus;
  readonly score: number | null;
  readonly source: GradeSource;
  readonly gradedBy: UserId;
  readonly comment: string | null;
}

export interface GradeInput {
  readonly id: GradeId;
  readonly schoolId: SchoolId;
  readonly studentId: StudentId;
  readonly assignmentId: AssignmentId;
  readonly status: GradeStatus;
  readonly score?: number | null | undefined;
  readonly maxPoints: number;
  readonly source: GradeSource;
  readonly gradedBy: UserId;
  readonly comment?: string | null;
}

const scoredStatuses: ReadonlySet<GradeStatus> = new Set(['graded', 'late']);

export function createGrade(input: GradeInput): Result<Grade, ValidationError> {
  const score = input.score ?? null;
  if (scoredStatuses.has(input.status)) {
    if (score === null || !(score >= 0 && score <= input.maxPoints)) {
      return invalid('score', 'out_of_range');
    }
  } else if (score !== null) {
    return invalid('score', 'invalid_format');
  }
  const comment = optionalText('comment', input.comment, 2000);
  if (!comment.ok) return comment;

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    studentId: input.studentId,
    assignmentId: input.assignmentId,
    status: input.status,
    score,
    source: input.source,
    gradedBy: input.gradedBy,
    comment: comment.value,
  });
}
