import { err, ok, type Result } from '@thp/domain';
import type { ClassroomError, GoogleSlidesFiles } from '@thp/ports';
import { localClassroomFixture } from './local-classroom.ts';

/** A stand-in for Google Slides in local runs and E2E tests: decks are only counted. */
export class LocalSlides implements GoogleSlidesFiles {
  private made = 0;

  createPresentation(
    accessToken: string,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    if (accessToken !== localClassroomFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.made += 1;
    const id = `local-deck-${String(this.made)}`;
    return Promise.resolve(ok({ id, url: `https://slides.local/presentation/d/${id}/edit` }));
  }
}
