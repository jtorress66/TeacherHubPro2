import {
  ok,
  optionalText,
  parseLocalDate,
  requiredText,
  type LocalDate,
  type Result,
  type User,
} from '@thp/domain';
import type { ClassroomCoursework, GoogleDriveFiles } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { accessToken, type ConnectionDeps } from './classroom.ts';
import { pdfSizeError } from './pdf-import.ts';

/**
 * Posts the teacher's own test PDF to a Classroom course as it is: no AI, nothing kept here. The
 * PDF goes to the teacher's Drive, and each student gets a copy to write on and hand in.
 */
export class PostPdfToClassroom {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly googleDrive: GoogleDriveFiles;
      readonly classroomCoursework: ClassroomCoursework;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly courseId: string;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: string | null;
    readonly fileName: string;
    readonly pdf: Uint8Array;
  }): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    const instructions = optionalText('instructions', input.instructions, 5000);
    if (!instructions.ok) return instructions;
    const size = pdfSizeError(input.pdf);
    if (!size.ok) return size;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const name = input.fileName.trim() === '' ? `${title.value}.pdf` : input.fileName.trim();
    const file = await this.deps.googleDrive.uploadPdf(token.value, { name, bytes: input.pdf });
    if (!file.ok) return fail('classroom_failed');
    const posted = await this.deps.classroomCoursework.createCoursework(
      token.value,
      input.courseId,
      {
        title: title.value,
        description: instructions.value ?? '',
        material: { kind: 'pdf', driveFileId: file.value.id },
        dueDate,
      },
    );
    return posted.ok ? ok({ url: posted.value.url }) : fail('classroom_failed');
  }
}
