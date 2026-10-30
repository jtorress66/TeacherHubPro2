import type { DraftRequest, LessonPlanDraft, Result } from '@thp/domain';

export interface DraftError {
  readonly code: 'ai_unavailable' | 'invalid_output';
}

/** Drafts a lesson plan for the teacher to review; it never saves anything. */
export interface LessonPlanDrafter {
  draft(request: DraftRequest): Promise<Result<LessonPlanDraft, DraftError>>;
}
