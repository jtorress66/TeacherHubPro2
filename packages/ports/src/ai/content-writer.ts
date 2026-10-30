import type { ContentRequest, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Writes teaching content (Markdown) for the teacher to review; it never saves anything. */
export interface ContentWriter {
  write(request: ContentRequest): Promise<Result<string, DraftError>>;
}
