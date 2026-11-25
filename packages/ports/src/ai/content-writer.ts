import type { ContentRequest, Guided, JobProgress, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Writes teaching content (Markdown) for the teacher to review; it never saves anything. */
export interface ContentWriter {
  /**
   * Long content is written in steps; `onProgress` hears which step starts. With `curriculum`, the
   * content follows the school's guide.
   */
  write(
    request: Guided<ContentRequest>,
    onProgress?: (progress: JobProgress) => Promise<void>,
  ): Promise<Result<string, DraftError>>;
}
