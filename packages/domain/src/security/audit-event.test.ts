import { describe, expect, it } from 'vitest';
import { approvalActions, auditActions, isApprovalAction } from './audit-event.ts';

describe('approval actions', () => {
  it('names the five places a teacher approves work that reaches students, families or a course system', () => {
    expect(approvalActions).toEqual([
      'ai_grade_approved',
      'game_grades_approved',
      'prep_approved',
      'learning_path_assigned',
      'grades_sent_to_course',
    ]);
  });

  it('logs an admin adding or removing a course system as activity, not as an approval', () => {
    expect(auditActions).toContain('lti_platform_added');
    expect(auditActions).toContain('lti_platform_removed');
    expect(isApprovalAction('lti_platform_added')).toBe(false);
  });

  it('are all ordinary activity log actions', () => {
    for (const action of approvalActions) expect(auditActions).toContain(action);
  });

  it('tells an approval from any other logged change', () => {
    expect(isApprovalAction('prep_approved')).toBe(true);
    expect(isApprovalAction('submission_graded')).toBe(false);
    expect(isApprovalAction('student_added')).toBe(false);
  });
});
