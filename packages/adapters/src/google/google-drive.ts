import { err, ok, type Result } from '@thp/domain';
import type { ClassroomError, GoogleDriveFiles } from '@thp/ports';
import { googleFailure } from './google-errors.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const googleDoc = 'application/vnd.google-apps.document';
const wordDocument = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** One multipart/related body: the file's JSON metadata, then the Word document's bytes. */
function multipart(boundary: string, name: string, bytes: Uint8Array): Blob {
  const metadata = JSON.stringify({ name, mimeType: googleDoc });
  return new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${wordDocument}\r\n\r\n`,
    Uint8Array.from(bytes),
    `\r\n--${boundary}--`,
  ]);
}

/**
 * Google Drive through its official REST API with the teacher's access token: uploads a Word
 * document and asks Drive to convert it to a Google Doc, for a Classroom assignment to attach.
 * With `drive.file`, the app sees only what it uploaded.
 */
export class GoogleDriveApi implements GoogleDriveFiles {
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly boundary = 'teacherhubpro-upload',
  ) {}

  async uploadWordAsDoc(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    try {
      const response = await this.fetchFn(uploadUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/related; boundary=${this.boundary}`,
        },
        // The Doc is named without ".docx", as Drive does when it converts a file itself.
        body: multipart(this.boundary, file.name.replace(/\.docx$/i, ''), file.bytes),
      });
      if (!response.ok) return err(await googleFailure(response));
      const body: unknown = await response.json();
      const id = typeof body === 'object' && body !== null && 'id' in body ? body.id : null;
      if (typeof id !== 'string') return err({ code: 'unavailable' });
      return ok({ id, url: `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit` });
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
