import type { Result } from '@thp/domain';
import type { ClassroomError } from './classroom.ts';

/** Puts files in the teacher's Google Drive; the app can reach only files it created. */
export interface GoogleDriveFiles {
  uploadPdf(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string }, ClassroomError>>;
  /** Uploads HTML that Drive converts to a Google Doc the teacher can edit. */
  uploadDoc(
    accessToken: string,
    doc: { readonly name: string; readonly html: string },
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>>;
}
