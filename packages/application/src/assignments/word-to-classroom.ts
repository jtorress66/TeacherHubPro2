import {
  ok,
  optionalText,
  parseLocalDate,
  parseWordDocument,
  requiredText,
  type LocalDate,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassroomCoursework,
  ClassroomError,
  CourseworkRequest,
  Delay,
  GoogleDriveFiles,
} from '@thp/ports';
import type { UseCaseError } from '../errors.ts';
import { accessToken, googleFailed, type ConnectionDeps } from './classroom.ts';

/**
 * Classroom can answer "not found" for a Doc Drive has only just converted: it is tried again
 * after these waits (about 7 seconds in all) before the teacher is told.
 */
const catchUpWaits = [1000, 2000, 4000] as const;

/**
 * Posts the teacher's own Word document to a Classroom course: Drive turns it into a Google Doc,
 * and each student gets a copy to type in. No AI; nothing is kept in TeacherHubPro.
 */
export class PostWordToClassroom {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly googleDrive: GoogleDriveFiles;
      readonly classroomCoursework: ClassroomCoursework;
      readonly delay: Delay;
    },
  ) {}

  private async createCoursework(
    token: string,
    courseId: string,
    request: CourseworkRequest,
  ): Promise<Result<{ readonly url: string }, ClassroomError>> {
    let posted = await this.deps.classroomCoursework.createCoursework(token, courseId, request);
    for (const wait of catchUpWaits) {
      if (posted.ok || posted.error.code !== 'not_found') return posted;
      await this.deps.delay.wait(wait);
      posted = await this.deps.classroomCoursework.createCoursework(token, courseId, request);
    }
    return posted;
  }

  async execute(input: {
    readonly actor: User;
    readonly courseId: string;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: string | null;
    readonly fileName: string;
    readonly bytes: Uint8Array;
  }): Promise<Result<{ readonly url: string; readonly docUrl: string }, UseCaseError>> {
    const course = requiredText('courseId', input.courseId);
    if (!course.ok) return course;
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    const instructions = optionalText('instructions', input.instructions, 5000);
    if (!instructions.ok) return instructions;
    const document = parseWordDocument(input.fileName, input.bytes);
    if (!document.ok) return document;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const doc = await this.deps.googleDrive.uploadWordAsDoc(token.value, document.value);
    if (!doc.ok) return googleFailed(doc.error);
    const posted = await this.createCoursework(token.value, course.value, {
      title: title.value,
      description: instructions.value ?? '',
      material: { kind: 'driveFile', driveFileId: doc.value.id },
      dueDate,
    });
    if (!posted.ok) return googleFailed(posted.error);
    return ok({ url: posted.value.url, docUrl: doc.value.url });
  }
}
