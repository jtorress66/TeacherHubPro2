import type { Result } from '@thp/domain';
import type { ClassroomError } from './classroom.ts';

/** Puts files in the teacher's Google Drive; the app can reach only files it created. */
export interface GoogleDriveFiles {
  /** Uploads a Word document unchanged; students' copies open in Google Docs. */
  uploadWordDocument(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>>;
}
