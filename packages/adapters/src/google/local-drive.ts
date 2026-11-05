import { err, ok, type Result } from '@thp/domain';
import type { ClassroomError, GoogleDriveFiles } from '@thp/ports';
import { localClassroomFixture } from './local-classroom.ts';

/** A stand-in for Google Drive in local runs and E2E tests: uploads are only counted. */
export class LocalDrive implements GoogleDriveFiles {
  private uploaded = 0;

  uploadPdf(accessToken: string): Promise<Result<{ readonly id: string }, ClassroomError>> {
    if (accessToken !== localClassroomFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.uploaded += 1;
    return Promise.resolve(ok({ id: `local-drive-${String(this.uploaded)}` }));
  }

  uploadDoc(
    accessToken: string,
  ): Promise<Result<{ readonly id: string; readonly url: string }, ClassroomError>> {
    if (accessToken !== localClassroomFixture.accessToken) {
      return Promise.resolve(err({ code: 'unauthorized' }));
    }
    this.uploaded += 1;
    const id = `local-doc-${String(this.uploaded)}`;
    return Promise.resolve(ok({ id, url: `https://docs.local/d/${id}/edit` }));
  }
}
