import type { Language, Result, UnexplainedItem } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Game items to explain: what each asks and its right answer, in the game's language. */
export interface ExplanationRequest {
  readonly language: Language;
  readonly items: readonly UnexplainedItem[];
}

/**
 * Drafts one short "why this is the answer" sentence per item, in the request's order, for the
 * teacher to review; it never saves anything.
 */
export interface ExplanationWriter {
  explain(request: ExplanationRequest): Promise<Result<readonly string[], DraftError>>;
}
