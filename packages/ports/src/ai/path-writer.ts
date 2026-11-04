import type { PathDraft, PathRequest, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Writes a learning path for the teacher to review; it never saves anything. */
export interface PathWriter {
  write(request: PathRequest): Promise<Result<PathDraft, DraftError>>;
}
