import {
  ok,
  optionalText,
  parseLocalDate,
  renderTestDocument,
  requiredText,
  type Job,
  type JobId,
  type LocalDate,
  type Result,
  type TestDocumentLabels,
  type User,
} from '@thp/domain';
import type {
  ClassroomCoursework,
  Clock,
  GoogleDriveFiles,
  JobQueue,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { accessToken, googleFailed, type ConnectionDeps } from './classroom.ts';
import { GetImportedTest, queueImport, type ClassroomPost, type QueueDeps } from './pdf-import.ts';

interface JobRef {
  readonly actor: User;
  readonly jobId: JobId;
}

/** The owner's finished import meant for a Classroom Doc, with what to post. */
async function docImport(deps: { readonly jobs: JobQueue }, input: JobRef) {
  const imported = await new GetImportedTest(deps).execute(input);
  if (!imported.ok) return imported;
  const test = imported.value;
  if (test.classId !== null || test.classroom === undefined) return fail('not_found');
  return ok({ ...test, classroom: test.classroom });
}

/**
 * Starts reading a test PDF to lay it out as a Google Doc students type in. Needs AI access; the
 * course, title, instructions and due date travel with the job.
 */
export class RequestDocImport {
  constructor(
    private readonly deps: QueueDeps & {
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly courseId: string;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: string | null;
    readonly pdf: Uint8Array;
  }): Promise<Result<Job, UseCaseError>> {
    const course = requiredText('courseId', input.courseId);
    if (!course.ok) return course;
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    const instructions = optionalText('instructions', input.instructions, 5000);
    if (!instructions.ok) return instructions;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    const classroom: ClassroomPost = {
      courseId: course.value,
      instructions: instructions.value,
      dueDate,
    };
    return queueImport(this.deps, input.actor, input.pdf, {
      classId: null,
      assignmentId: null,
      title: title.value,
      classroom,
    });
  }
}

/** Lays the read test out as a clean Google Doc in the teacher's Drive, without any answers. */
export class MakeTestDoc {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly jobs: JobQueue;
      readonly googleDrive: GoogleDriveFiles;
    },
  ) {}

  async execute(
    input: JobRef & { readonly labels: TestDocumentLabels },
  ): Promise<Result<{ readonly docId: string; readonly url: string }, UseCaseError>> {
    const found = await docImport(this.deps, input);
    if (!found.ok) return found;
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const { title, test } = found.value;
    const doc = await this.deps.googleDrive.uploadDoc(token.value, {
      name: title,
      html: renderTestDocument(
        { title, instructions: test.instructions, questions: test.questions },
        input.labels,
      ),
    });
    if (!doc.ok) return googleFailed(doc.error);
    return ok({ docId: doc.value.id, url: doc.value.url });
  }
}

/** Posts the Doc to the job's Classroom course, a copy for each student to type in. */
export class PostDocToClassroom {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly jobs: JobQueue;
      readonly classroomCoursework: ClassroomCoursework;
    },
  ) {}

  async execute(
    input: JobRef & { readonly docId: string },
  ): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const found = await docImport(this.deps, input);
    if (!found.ok) return found;
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const { title, classroom } = found.value;
    const posted = await this.deps.classroomCoursework.createCoursework(
      token.value,
      classroom.courseId,
      {
        title,
        description: classroom.instructions ?? '',
        material: { kind: 'driveFile', driveFileId: input.docId },
        dueDate: classroom.dueDate,
      },
    );
    return posted.ok ? ok({ url: posted.value.url }) : googleFailed(posted.error);
  }
}
