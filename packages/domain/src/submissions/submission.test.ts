import { describe, expect, it } from 'vitest';
import {
  type AssignmentId,
  type GradeId,
  type QuestionId,
  type SchoolId,
  type StudentId,
  type SubmissionId,
  type UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  confirmAiGrade,
  createSubmission,
  gradeManually,
  recordAiFailure,
  recordAiGrade,
  type Submission,
} from './submission.ts';

const teacherId = 'teacher-1' as UserId;
const gradeId = 'grade-1' as GradeId;
const submittedAt = new Date('2026-09-18T14:00:00Z');
const input = {
  id: 'sub-1' as SubmissionId,
  schoolId: 'school-1' as SchoolId,
  assignmentId: 'a1' as AssignmentId,
  studentId: 'student-7' as StudentId,
  answers: { ['q1' as QuestionId]: 'Jupiter' },
  submittedAt,
  maxPoints: 20,
};

const submitted = (): Submission => valueOf(createSubmission(input));
const aiGraded = (): Submission =>
  valueOf(recordAiGrade(submitted(), { score: 16, feedback: 'Good reasoning' }));

describe('createSubmission', () => {
  it('starts as submitted, tied to a roster student id, with no grade yet', () => {
    expect(submitted()).toEqual({
      ...input,
      late: false,
      questionScores: {},
      status: 'submitted',
      aiDraft: null,
      aiFailure: null,
      finalScore: null,
      confirmedBy: null,
    });
  });

  it('cannot be created without a roster student id', () => {
    expect(errorOf(createSubmission({ ...input, studentId: '' as StudentId }))).toEqual({
      field: 'studentId',
      code: 'required',
    });
  });

  it('needs a positive maximum score', () => {
    expect(errorOf(createSubmission({ ...input, maxPoints: 0 }))).toEqual({
      field: 'maxPoints',
      code: 'out_of_range',
    });
  });
});

describe('AI grading', () => {
  it('stores the AI score as a draft only', () => {
    const graded = aiGraded();

    expect(graded.status).toBe('ai_graded');
    expect(graded.aiDraft).toEqual({ score: 16, feedback: 'Good reasoning' });
    expect(graded.finalScore).toBeNull();
  });

  it('can grade again while still a draft', () => {
    const regraded = valueOf(recordAiGrade(aiGraded(), { score: 18, feedback: 'Better' }));
    expect(regraded.aiDraft?.score).toBe(18);
  });

  it('an AI score outside 0..max is rejected', () => {
    for (const score of [-1, 21, Number.NaN]) {
      expect(errorOf(recordAiGrade(submitted(), { score, feedback: '' }))).toEqual({
        field: 'score',
        code: 'out_of_range',
      });
    }
  });

  it('records an AI failure and stays submitted; a later AI grade clears it', () => {
    const failed = valueOf(recordAiFailure(submitted(), 'model unavailable'));
    expect([failed.status, failed.aiFailure]).toEqual(['submitted', 'model unavailable']);

    const graded = valueOf(recordAiGrade(failed, { score: 10, feedback: 'ok' }));
    expect(graded.aiFailure).toBeNull();
  });

  it('cannot record an AI failure once graded', () => {
    expect(errorOf(recordAiFailure(aiGraded(), 'late failure'))).toEqual({
      code: 'invalid_transition',
      from: 'ai_graded',
      action: 'record_ai_failure',
    });
  });
});

describe('teacher confirmation', () => {
  it('AI grade, then confirm, makes a confirmed Grade', () => {
    const { submission, grade } = valueOf(confirmAiGrade(aiGraded(), { gradeId, teacherId }));

    expect(submission).toMatchObject({
      status: 'confirmed',
      finalScore: 16,
      confirmedBy: teacherId,
    });
    expect(grade).toEqual({
      id: gradeId,
      schoolId: input.schoolId,
      studentId: input.studentId,
      assignmentId: input.assignmentId,
      status: 'graded',
      score: 16,
      source: 'confirmed_ai',
      gradedBy: teacherId,
      comment: null,
    });
  });

  it('the teacher’s override replaces the AI score', () => {
    const { submission, grade } = valueOf(
      confirmAiGrade(aiGraded(), { gradeId, teacherId, score: 19, comment: 'Generous on Q2' }),
    );

    expect(submission.finalScore).toBe(19);
    expect(grade).toMatchObject({ score: 19, comment: 'Generous on Q2', source: 'confirmed_ai' });
  });

  it('rejects an override outside 0..max', () => {
    expect(errorOf(confirmAiGrade(aiGraded(), { gradeId, teacherId, score: 25 }))).toEqual({
      field: 'score',
      code: 'out_of_range',
    });
  });

  it('cannot confirm an AI grade that does not exist yet', () => {
    expect(errorOf(confirmAiGrade(submitted(), { gradeId, teacherId }))).toEqual({
      code: 'invalid_transition',
      from: 'submitted',
      action: 'confirm_ai_grade',
    });
  });

  it('refuses to confirm a corrupt ai_graded record that has no draft', () => {
    const corrupt: Submission = { ...submitted(), status: 'ai_graded' };

    expect(errorOf(confirmAiGrade(corrupt, { gradeId, teacherId }))).toEqual({
      code: 'invalid_transition',
      from: 'ai_graded',
      action: 'confirm_ai_grade',
    });
  });

  it('a manual grade goes straight from submitted to confirmed', () => {
    const { submission, grade } = valueOf(
      gradeManually(submitted(), { gradeId, teacherId, score: 12 }),
    );

    expect(submission).toMatchObject({ status: 'confirmed', finalScore: 12 });
    expect(grade).toMatchObject({ score: 12, source: 'manual' });
  });

  it('a manual grade takes precedence over an AI draft', () => {
    const { grade } = valueOf(gradeManually(aiGraded(), { gradeId, teacherId, score: 5 }));
    expect(grade).toMatchObject({ score: 5, source: 'manual' });
  });

  it('rejects a manual score outside 0..max', () => {
    expect(errorOf(gradeManually(submitted(), { gradeId, teacherId, score: -2 }))).toEqual({
      field: 'score',
      code: 'out_of_range',
    });
  });

  it('cannot confirm twice', () => {
    const { submission } = valueOf(confirmAiGrade(aiGraded(), { gradeId, teacherId }));

    expect(errorOf(confirmAiGrade(submission, { gradeId, teacherId }))).toEqual({
      code: 'invalid_transition',
      from: 'confirmed',
      action: 'confirm_ai_grade',
    });
    expect(errorOf(gradeManually(submission, { gradeId, teacherId, score: 1 }))).toEqual({
      code: 'invalid_transition',
      from: 'confirmed',
      action: 'grade_manually',
    });
  });

  it('the AI cannot re-grade a confirmed submission', () => {
    const { submission } = valueOf(gradeManually(submitted(), { gradeId, teacherId, score: 12 }));

    expect(errorOf(recordAiGrade(submission, { score: 1, feedback: '' }))).toEqual({
      code: 'invalid_transition',
      from: 'confirmed',
      action: 'record_ai_grade',
    });
  });
});
