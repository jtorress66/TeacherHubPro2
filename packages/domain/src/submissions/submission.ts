import { createGrade, type Grade } from '../gradebook/grade.ts';
import type {
  AssignmentId,
  GradeId,
  QuestionId,
  SchoolId,
  StudentId,
  SubmissionId,
  UserId,
} from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

export const submissionStatuses = ['submitted', 'ai_graded', 'confirmed'] as const;

export type SubmissionStatus = (typeof submissionStatuses)[number];

export type SubmissionAction =
  'record_ai_grade' | 'record_ai_failure' | 'confirm_ai_grade' | 'grade_manually';

export type SubmissionError =
  ValidationError | InvalidTransition<SubmissionStatus, SubmissionAction>;

/** A question's score in a submission: scored by code (objective) or suggested by the AI. */
export interface QuestionScore {
  readonly score: number;
  readonly feedback: string | null;
  readonly source: 'auto' | 'ai';
}

/** An AI suggestion. It never counts until a teacher confirms it. */
export interface AiDraft {
  readonly score: number;
  readonly feedback: string;
}

export interface Submission {
  readonly id: SubmissionId;
  readonly schoolId: SchoolId;
  readonly assignmentId: AssignmentId;
  /** Always a roster student id; never matched by a typed name. */
  readonly studentId: StudentId;
  readonly answers: Readonly<Record<QuestionId, string>>;
  readonly submittedAt: Date;
  /** The assignment's maximum score when the student submitted. */
  readonly maxPoints: number;
  /** Submitted after the due date (still accepted). */
  readonly late: boolean;
  /** Per-question scores so far; the draft total is their sum. */
  readonly questionScores: Readonly<Record<QuestionId, QuestionScore>>;
  readonly status: SubmissionStatus;
  readonly aiDraft: AiDraft | null;
  readonly aiFailure: string | null;
  readonly finalScore: number | null;
  readonly confirmedBy: UserId | null;
}

export interface SubmissionInput {
  readonly id: SubmissionId;
  readonly schoolId: SchoolId;
  readonly assignmentId: AssignmentId;
  readonly studentId: StudentId;
  readonly answers: Readonly<Record<QuestionId, string>>;
  readonly submittedAt: Date;
  readonly maxPoints: number;
  readonly late?: boolean;
  readonly questionScores?: Readonly<Record<QuestionId, QuestionScore>>;
}

export interface TeacherDecision {
  readonly gradeId: GradeId;
  readonly teacherId: UserId;
  readonly comment?: string | null;
}

export interface ConfirmedSubmission {
  readonly submission: Submission;
  readonly grade: Grade;
}

const transitions: TransitionTable<SubmissionStatus, SubmissionAction> = {
  record_ai_grade: ['submitted', 'ai_graded'],
  record_ai_failure: ['submitted'],
  confirm_ai_grade: ['ai_graded'],
  grade_manually: ['submitted', 'ai_graded'],
};

const inRange = (score: number, max: number): boolean => score >= 0 && score <= max;

export function createSubmission(input: SubmissionInput): Result<Submission, ValidationError> {
  if (input.studentId.trim() === '') return invalid('studentId', 'required');
  if (!(input.maxPoints > 0)) return invalid('maxPoints', 'out_of_range');
  return ok({
    ...input,
    late: input.late ?? false,
    questionScores: input.questionScores ?? {},
    status: 'submitted',
    aiDraft: null,
    aiFailure: null,
    finalScore: null,
    confirmedBy: null,
  });
}

export function recordAiGrade(
  submission: Submission,
  draft: AiDraft,
): Result<Submission, SubmissionError> {
  const allowed = guardTransition(transitions, submission.status, 'record_ai_grade');
  if (!allowed.ok) return allowed;
  if (!inRange(draft.score, submission.maxPoints)) return invalid('score', 'out_of_range');
  return ok({ ...submission, status: 'ai_graded', aiDraft: draft, aiFailure: null });
}

export function recordAiFailure(
  submission: Submission,
  reason: string,
): Result<Submission, SubmissionError> {
  const allowed = guardTransition(transitions, submission.status, 'record_ai_failure');
  if (!allowed.ok) return allowed;
  return ok({ ...submission, aiFailure: reason });
}

function confirm(
  submission: Submission,
  decision: TeacherDecision,
  score: number,
  source: Grade['source'],
): Result<ConfirmedSubmission, SubmissionError> {
  const grade = createGrade({
    id: decision.gradeId,
    schoolId: submission.schoolId,
    studentId: submission.studentId,
    assignmentId: submission.assignmentId,
    status: 'graded',
    score,
    maxPoints: submission.maxPoints,
    source,
    gradedBy: decision.teacherId,
    comment: decision.comment ?? null,
  });
  if (!grade.ok) return grade;
  return ok({
    submission: {
      ...submission,
      status: 'confirmed',
      finalScore: score,
      confirmedBy: decision.teacherId,
    },
    grade: grade.value,
  });
}

/** The teacher accepts the AI draft, optionally with a different score. */
export function confirmAiGrade(
  submission: Submission,
  decision: TeacherDecision & { readonly score?: number },
): Result<ConfirmedSubmission, SubmissionError> {
  const allowed = guardTransition(transitions, submission.status, 'confirm_ai_grade');
  if (!allowed.ok) return allowed;
  const draft = submission.aiDraft;
  if (draft === null) {
    // An ai_graded record without a draft is corrupt; refuse rather than invent a score.
    return err({ code: 'invalid_transition', from: submission.status, action: 'confirm_ai_grade' });
  }
  return confirm(submission, decision, decision.score ?? draft.score, 'confirmed_ai');
}

/** The teacher grades directly; this takes precedence over any AI draft. */
export function gradeManually(
  submission: Submission,
  decision: TeacherDecision & { readonly score: number },
): Result<ConfirmedSubmission, SubmissionError> {
  const allowed = guardTransition(transitions, submission.status, 'grade_manually');
  if (!allowed.ok) return allowed;
  return confirm(submission, decision, decision.score, 'manual');
}
