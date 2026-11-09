import type { Result, RubricDraft, RubricRequest } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Drafts a rubric for the teacher to edit; it never saves anything. */
export interface RubricDrafter {
  draft(request: RubricRequest): Promise<Result<RubricDraft, DraftError>>;
}
