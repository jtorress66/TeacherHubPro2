import type { GoogleDeck, Result } from '@thp/domain';
import type { ClassroomError } from './classroom.ts';

/** Makes Google Slides decks in the teacher's Drive; the app can reach only decks it made. */
export interface GoogleSlidesFiles {
  createPresentation(
    accessToken: string,
    deck: GoogleDeck,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>>;
}
