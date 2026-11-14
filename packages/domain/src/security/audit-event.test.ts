import { describe, expect, it } from 'vitest';
import { approvalActions, auditActions, isApprovalAction } from './audit-event.ts';

describe('approval actions', () => {
  it('names the four places a teacher approves AI work that reaches students or families', () => {
    expect(approvalActions).toEqual([
      'ai_grade_approved',
      'game_grades_approved',
      'prep_approved',
      'learning_path_assigned',
    ]);
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
