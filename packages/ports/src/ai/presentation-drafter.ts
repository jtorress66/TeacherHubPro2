import type { PresentationDraft, PresentationRequest, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Drafts slides for the teacher to edit; it never saves anything. */
export interface PresentationDrafter {
  draft(request: PresentationRequest): Promise<Result<PresentationDraft, DraftError>>;
}
