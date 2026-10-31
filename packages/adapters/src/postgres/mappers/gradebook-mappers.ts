import {
  gradeSources,
  gradeStatuses,
  submissionStatuses,
  type AiDraft,
  type Assignment,
  type AssignmentId,
  type ClassId,
  type Grade,
  type GradeCategory,
  type GradeCategoryId,
  type GradeId,
  type Question,
  type QuestionId,
  type ReportCardComment,
  type ReportCardCommentId,
  type SchoolId,
  type StudentId,
  type Submission,
  type SubmissionId,
  type UserId,
} from '@thp/domain';
import type {
  AssignmentsTable,
  GradeCategoriesTable,
  GradesTable,
  ReportCardCommentsTable,
  SubmissionsTable,
} from '../schema.ts';
import { localDate, oneOf, readJson, toJson, type RowMapper } from './columns.ts';

export const gradeCategoryMapper: RowMapper<GradeCategory, GradeCategoriesTable> = {
  toRow: (category) => ({
    id: category.id,
    school_id: category.schoolId,
    class_id: category.classId,
    name: category.name,
    weight_percent: category.weightPercent,
  }),
  fromRow: (row) => ({
    id: row.id as GradeCategoryId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    name: row.name,
    weightPercent: row.weight_percent,
  }),
};

export const assignmentMapper: RowMapper<Assignment, AssignmentsTable> = {
  toRow: (assignment) => ({
    id: assignment.id,
    school_id: assignment.schoolId,
    class_id: assignment.classId,
    category_id: assignment.categoryId,
    title: assignment.title,
    points: assignment.points,
    due_date: assignment.dueDate,
    instructions: assignment.instructions,
    questions: toJson(assignment.questions),
  }),
  fromRow: (row) => ({
    id: row.id as AssignmentId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    categoryId: row.category_id as GradeCategoryId,
    title: row.title,
    points: row.points,
    dueDate: row.due_date === null ? null : localDate(row.due_date, 'assignments.due_date'),
    instructions: row.instructions,
    questions: readJson(row.questions) as readonly Question[],
  }),
};

export const gradeMapper: RowMapper<Grade, GradesTable> = {
  toRow: (grade) => ({
    id: grade.id,
    school_id: grade.schoolId,
    student_id: grade.studentId,
    assignment_id: grade.assignmentId,
    status: grade.status,
    score: grade.score,
    source: grade.source,
    graded_by: grade.gradedBy,
    comment: grade.comment,
  }),
  fromRow: (row) => ({
    id: row.id as GradeId,
    schoolId: row.school_id as SchoolId,
    studentId: row.student_id as StudentId,
    assignmentId: row.assignment_id as AssignmentId,
    status: oneOf(gradeStatuses, row.status, 'grades.status'),
    score: row.score,
    source: oneOf(gradeSources, row.source, 'grades.source'),
    gradedBy: row.graded_by as UserId,
    comment: row.comment,
  }),
};

export const submissionMapper: RowMapper<Submission, SubmissionsTable> = {
  toRow: (submission) => ({
    id: submission.id,
    school_id: submission.schoolId,
    assignment_id: submission.assignmentId,
    student_id: submission.studentId,
    answers: toJson(submission.answers),
    submitted_at: submission.submittedAt,
    max_points: submission.maxPoints,
    status: submission.status,
    ai_draft: submission.aiDraft === null ? null : toJson(submission.aiDraft),
    ai_failure: submission.aiFailure,
    final_score: submission.finalScore,
    confirmed_by: submission.confirmedBy,
    late: submission.late,
    question_scores: toJson(submission.questionScores),
  }),
  fromRow: (row) => ({
    id: row.id as SubmissionId,
    schoolId: row.school_id as SchoolId,
    assignmentId: row.assignment_id as AssignmentId,
    studentId: row.student_id as StudentId,
    answers: readJson(row.answers) as Readonly<Record<QuestionId, string>>,
    submittedAt: row.submitted_at,
    maxPoints: row.max_points,
    status: oneOf(submissionStatuses, row.status, 'submissions.status'),
    aiDraft: row.ai_draft === null ? null : (readJson(row.ai_draft) as AiDraft),
    aiFailure: row.ai_failure,
    finalScore: row.final_score,
    confirmedBy: row.confirmed_by as UserId | null,
    late: row.late,
    questionScores: readJson(row.question_scores) as Submission['questionScores'],
  }),
};

export const reportCardCommentMapper: RowMapper<ReportCardComment, ReportCardCommentsTable> = {
  toRow: (comment) => ({
    id: comment.id,
    school_id: comment.schoolId,
    class_id: comment.classId,
    student_id: comment.studentId,
    text: comment.text,
    written_by: comment.writtenBy,
  }),
  fromRow: (row) => ({
    id: row.id as ReportCardCommentId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    studentId: row.student_id as StudentId,
    text: row.text,
    writtenBy: row.written_by as UserId,
  }),
};
