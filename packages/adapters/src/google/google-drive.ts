import { err, ok, type Result } from '@thp/domain';
import type { ClassroomError, GoogleDriveFiles } from '@thp/ports';
import { googleFailure } from './google-errors.ts';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const googleDoc = 'application/vnd.google-apps.document';

interface Upload {
  readonly name: string;
  /** What Drive stores: a PDF as is, or a Google Doc converted from HTML. */
  readonly storedAs: string;
  readonly contentType: string;
  readonly content: Uint8Array | string;
}

/** One multipart/related body: the file's JSON metadata, then its content. */
function multipart(boundary: string, upload: Upload): Blob {
  const metadata = JSON.stringify({ name: upload.name, mimeType: upload.storedAs });
  return new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${upload.contentType}\r\n\r\n`,
    typeof upload.content === 'string' ? upload.content : Uint8Array.from(upload.content),
    `\r\n--${boundary}--`,
  ]);
}

/**
 * Google Drive through its official REST API with the teacher's access token: uploads a PDF, or
 * HTML that Drive converts to a Google Doc, for a Classroom assignment to attach. With
 * `drive.file`, the app sees only what it uploaded.
 */
export class GoogleDriveApi implements GoogleDriveFiles {
  constructor(
    private readonly fetchFn: Fetch = fetch,
    private readonly boundary = 'teacherhubpro-upload',
  ) {}

  private async upload(
    accessToken: string,
    upload: Upload,
  ): Promise<Result<{ readonly id: string }, ClassroomError>> {
    try {
      const response = await this.fetchFn(uploadUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': `multipart/related; boundary=${this.boundary}`,
        },
        body: multipart(this.boundary, upload),
      });
      if (!response.ok) return err(await googleFailure(response));
      const body: unknown = await response.json();
      const id = typeof body === 'object' && body !== null && 'id' in body ? body.id : null;
      return typeof id === 'string' ? ok({ id }) : err({ code: 'unavailable' });
    } catch {
      return err({ code: 'unavailable' });
    }
  }

  uploadPdf(
    accessToken: string,
    file: { readonly name: string; readonly bytes: Uint8Array },
  ): Promise<Result<{ readonly id: string }, ClassroomError>> {
    return this.upload(accessToken, {
      name: file.name,
      storedAs: 'application/pdf',
      contentType: 'application/pdf',
      content: file.bytes,
    });
  }

  async uploadDoc(
    accessToken: string,
    doc: { readonly name: string; readonly html: string },
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    const uploaded = await this.upload(accessToken, {
      name: doc.name,
      storedAs: googleDoc,
      contentType: 'text/html; charset=UTF-8',
      content: doc.html,
    });
    if (!uploaded.ok) return uploaded;
    const { id } = uploaded.value;
    return ok({ id, url: `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit` });
  }
}
