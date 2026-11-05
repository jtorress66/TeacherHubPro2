import {
  ok,
  optionalText,
  parseLocalDate,
  renderTestLayout,
  requiredText,
  type Job,
  type JobFailure,
  type JobId,
  type LocalDate,
  type Result,
  type TestLayout,
  type User,
} from '@thp/domain';
import type {
  ClassroomCoursework,
  Clock,
  FileStore,
  GoogleDriveFiles,
  JobQueue,
  PdfTextExtractor,
  SubscriptionRepository,
  TestTranscriber,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { accessToken, googleFailed, type ConnectionDeps } from './classroom.ts';
import { queuePdfJob, withPdfText, type QueueDeps } from './pdf-import.ts';

export const testDocJobKind = 'assignment.test_doc';

/** Where the Doc is posted, chosen with the PDF. */
interface ClassroomPost {
  readonly courseId: string;
  readonly instructions: string | null;
  readonly dueDate: LocalDate | null;
}

interface TestDocPayload {
  readonly fileKey: string;
  readonly title: string;
  readonly classroom: ClassroomPost;
}

/** What a finished job offers: the test's layout as printed, and where it goes. */
export interface TranscribedTest {
  readonly title: string;
  readonly layout: TestLayout;
  readonly classroom: ClassroomPost;
}

interface JobRef {
  readonly actor: User;
  readonly jobId: JobId;
}

/** The actor's own finished Doc job. */
export async function findTranscribedTest(
  deps: { readonly jobs: JobQueue },
  input: JobRef,
): Promise<Result<TranscribedTest, UseCaseError>> {
  const job = await deps.jobs.findForOwner(input.actor.schoolId, input.actor.id, input.jobId);
  if (job?.kind !== testDocJobKind || job.status !== 'completed') return fail('not_found');
  return ok(job.result as TranscribedTest);
}

/** The actor's finished Doc job, for its page. */
export class GetTranscribedTest {
  constructor(private readonly deps: { readonly jobs: JobQueue }) {}

  execute(input: JobRef): Promise<Result<TranscribedTest, UseCaseError>> {
    return findTranscribedTest(this.deps, input);
  }
}

/**
 * Starts copying a test PDF's layout, to post it as a Google Doc students type in. Needs AI
 * access; the course, title, instructions and due date travel with the job.
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
    const data: Omit<TestDocPayload, 'fileKey'> = {
      title: title.value,
      classroom: { courseId: course.value, instructions: instructions.value, dueDate },
    };
    return queuePdfJob(this.deps, input.actor, input.pdf, { kind: testDocJobKind, data });
  }
}

/** Reads the PDF's text, has the AI copy its layout as printed, and removes the PDF. */
export class TestDocHandler implements JobHandler {
  readonly kind = testDocJobKind;

  constructor(
    private readonly deps: {
      readonly files: FileStore;
      readonly pdfText: PdfTextExtractor;
      readonly testTranscriber: TestTranscriber;
    },
  ) {}

  handle(job: Job): Promise<Result<TranscribedTest, { readonly code: JobFailure }>> {
    const payload = job.payload as TestDocPayload;
    return withPdfText(this.deps, payload.fileKey, async (text) => {
      const layout = await this.deps.testTranscriber.transcribe({ text });
      if (!layout.ok) return layout;
      return ok({ title: payload.title, layout: layout.value, classroom: payload.classroom });
    });
  }
}

/** Builds the Google Doc in the teacher's Drive from the copied layout. */
export class MakeTestDoc {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly jobs: JobQueue;
      readonly googleDrive: GoogleDriveFiles;
    },
  ) {}

  async execute(
    input: JobRef,
  ): Promise<Result<{ readonly docId: string; readonly url: string }, UseCaseError>> {
    const found = await findTranscribedTest(this.deps, input);
    if (!found.ok) return found;
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const doc = await this.deps.googleDrive.uploadDoc(token.value, {
      name: found.value.title,
      html: renderTestLayout(found.value.layout),
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
    const found = await findTranscribedTest(this.deps, input);
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
