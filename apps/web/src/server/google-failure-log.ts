import type { ClassroomCoursework, ClassroomError, GoogleDriveFiles } from '@thp/ports';

type Write = (line: string) => void;

const stdout: Write = (line) => process.stdout.write(line);

const describeFailure = (step: string, error: ClassroomError) =>
  `${step} failed: ${error.code}${error.reason === undefined ? '' : ` (${error.reason})`}\n`;

/**
 * Logs why Google refused a Drive upload: only the step, the code and Google's reason token,
 * never tokens, titles or files. Results pass through unchanged.
 */
export function loggedDrive(drive: GoogleDriveFiles, write: Write = stdout): GoogleDriveFiles {
  return {
    async uploadPdf(accessToken, file) {
      const result = await drive.uploadPdf(accessToken, file);
      if (!result.ok) write(describeFailure('Google Drive upload', result.error));
      return result;
    },
  };
}

/** The same for creating Classroom coursework. */
export function loggedCoursework(
  coursework: ClassroomCoursework,
  write: Write = stdout,
): ClassroomCoursework {
  return {
    async createCoursework(accessToken, courseId, request) {
      const result = await coursework.createCoursework(accessToken, courseId, request);
      if (!result.ok) write(describeFailure('Google Classroom coursework', result.error));
      return result;
    },
  };
}
