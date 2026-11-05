import { err, ok, type Result } from '@thp/domain';
import type { ClassroomError, GoogleDriveFiles } from '@thp/ports';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

function failure(status: number): ClassroomError {
  if (status === 401 || status === 403) return { code: 'unauthorized' };
  if (status === 404) return { code: 'not_found' };
  return { code: 'unavailable' };
}

/** One multipart/related body: the file's JSON metadata, then its bytes. */
function multipart(boundary: string, name: string, bytes: Uint8Array): Blob {
  const metadata = JSON.stringify({ name, mimeType: 'application/pdf' });
  return new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    Uint8Array.from(bytes),
    `\r\n--${boundary}--`,
  ]);
}

/**
 * Google Drive through its official REST API with the teacher's access token: uploads a PDF so a
 * Classroom assignment can attach it. With `drive.file`, the app sees only what it uploaded.
 */
export class GoogleDriveApi implements GoogleDriveFiles {
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly boundary = 'teacherhubpro-upload',
  ) {}

  async uploadPdf(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string }, ClassroomError>> {
    try {
      const response = await this.fetchFn(uploadUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/related; boundary=${this.boundary}`,
        },
        body: multipart(this.boundary, file.name, file.bytes),
      });
      if (!response.ok) return err(failure(response.status));
      const body: unknown = await response.json();
      const id = typeof body === 'object' && body !== null && 'id' in body ? body.id : null;
      return typeof id === 'string' ? ok({ id }) : err({ code: 'unavailable' });
    } catch {
      return err({ code: 'unavailable' });
    }
  }
}
