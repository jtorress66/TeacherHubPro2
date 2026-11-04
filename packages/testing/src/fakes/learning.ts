import { err, ok, type PathDraft, type PathRequest, type Result } from '@thp/domain';
import type { DraftError, PathWriter } from '@thp/ports';
import { aLearningLesson } from '../fixtures.ts';

/** Writes the lessons asked for (or fails), and records each request. */
export class FakePathWriter implements PathWriter {
  readonly requests: PathRequest[] = [];

  constructor(private readonly failure: DraftError['code'] | null = null) {}

  write(request: PathRequest): Promise<Result<PathDraft, DraftError>> {
    this.requests.push(request);
    if (this.failure !== null) return Promise.resolve(err({ code: this.failure }));
    return Promise.resolve(
      ok({
        title: 'Fractions, step by step',
        description: 'Comparing and ordering fractions.',
        lessons: Array.from({ length: request.lessonCount }, (_, i) => aLearningLesson(i + 1)),
      }),
    );
  }
}
