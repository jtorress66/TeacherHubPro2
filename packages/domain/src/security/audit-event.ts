import type { Id, SchoolId, UserId } from '../shared/ids.ts';

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
] as const;
export type AuditAction = (typeof auditActions)[number];

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
}
