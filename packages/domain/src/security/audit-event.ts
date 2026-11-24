import type { ClassId, Id, SchoolId, UserId } from '../shared/ids.ts';

export type AuditEventId = Id<'AuditEvent'>;

/** What a teacher or admin did; the list is fixed so the log stays readable and free of content. */
export const auditActions = [
  'grades_saved',
  'submission_graded',
  'student_added',
  'student_updated',
  'student_removed',
  'students_imported',
  'links_issued',
  'link_revoked',
  'portal_link_issued',
  'portal_link_revoked',
  'role_changed',
  'password_link_sent',
  'teachers_imported',
  'school_updated',
  'ai_grade_approved',
  'game_grades_approved',
  'prep_approved',
  'learning_path_assigned',
  'grades_sent_to_course',
  'lti_platform_added',
  'lti_platform_removed',
  'school_data_exported',
  'school_deletion_requested',
  'school_deletion_canceled',
  'school_ai_turned_off',
  'school_ai_turned_on',
  'school_student_flags_turned_off',
  'school_student_flags_turned_on',
  'school_trial_extended',
  'curriculum_uploaded',
  'curriculum_removed',
] as const;
export type AuditAction = (typeof auditActions)[number];

/**
 * The moments a teacher approves work that then reaches students, families or a course system:
 * AI work, and confirmed grades sent to a course's gradebook. Each is logged by the use case (or
 * job) itself, so no screen can skip it.
 */
export const approvalActions = [
  'ai_grade_approved',
  'game_grades_approved',
  'prep_approved',
  'learning_path_assigned',
  'grades_sent_to_course',
] as const satisfies readonly AuditAction[];
export type ApprovalAction = (typeof approvalActions)[number];

export function isApprovalAction(action: AuditAction): action is ApprovalAction {
  return (approvalActions as readonly AuditAction[]).includes(action);
}

/** For an approved AI grade: whether the teacher kept the suggested score or changed it. */
export const approvalReviews = ['kept', 'changed'] as const;
export type ApprovalReview = (typeof approvalReviews)[number];

/**
 * One line of a school's activity log. It names who did what to which record (by ID) and when;
 * it never holds names, grades or student work.
 */
export interface AuditEvent {
  readonly id: AuditEventId;
  readonly schoolId: SchoolId;
  readonly actorId: UserId;
  readonly action: AuditAction;
  readonly targetId: string | null;
  readonly at: Date;
  /** Approved AI grades only: whether the suggested score was kept. */
  readonly review: ApprovalReview | null;
  /**
   * Approvals only, when it matters: grades saved or sent, or family emails sent. Never a score.
   */
  readonly count: number | null;
  /** Approvals only: the class the approved work belongs to. */
  readonly classId: ClassId | null;
}
