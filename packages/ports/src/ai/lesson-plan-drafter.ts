import type { DraftRequest, Guided, LessonPlanDraft, Result } from '@thp/domain';

export interface DraftError {
  readonly code: 'ai_unavailable' | 'invalid_output';
}

/** Drafts a lesson plan for the teacher to review; it never saves anything. */
export interface LessonPlanDrafter {
  /** With `curriculum`, the plan follows the school's guide. */
  draft(request: Guided<DraftRequest>): Promise<Result<LessonPlanDraft, DraftError>>;
}
