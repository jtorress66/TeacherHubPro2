import {
  err,
  maxAttachmentBytes,
  ok,
  requiredText,
  type AssignmentId,
  type ClassId,
  type ExtractedTest,
  type Job,
  type JobFailure,
  type JobId,
  type Language,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  FileStore,
  IdGenerator,
  JobQueue,
  PdfTextExtractor,
  QuestionExtractor,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import {
  editableAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';

export const pdfImportJobKind = 'assignment.pdf_import';

/** Where the questions go: an assignment, or (no class) a Google Forms quiz. */
type ImportTarget =
  | { readonly classId: ClassId; readonly assignmentId: AssignmentId }
  | { readonly classId: null; readonly assignmentId: null; readonly title: string };

type PdfImportPayload = ImportTarget & {
  readonly fileKey: string;
  readonly language: Language;
};

/** A PDF the import refuses before storing it: empty, or over the attachment limit. */
export const pdfSizeError = (pdf: Uint8Array): Result<true, UseCaseError> =>
  pdf.length === 0 || pdf.length > maxAttachmentBytes
    ? { ok: false, error: { field: 'pdf', code: 'too_large' } }
    : ok(true);

/** What a finished import offers the teacher: the questions to review, and where they go. */
export type ImportedTest = ImportTarget & { readonly test: ExtractedTest };

export interface QueueDeps {
  readonly files: FileStore;
  readonly jobs: JobQueue;
  readonly ids: IdGenerator;
}

/**
 * Keeps the PDF only for the job, and queues a job of the kind to read it; the payload gets the
 * stored file's key and the teacher's language.
 */
export async function queuePdfJob(
  deps: QueueDeps,
  actor: User,
  pdf: Uint8Array,
  job: { readonly kind: string; readonly data: object },
): Promise<Result<Job, UseCaseError>> {
  const size = pdfSizeError(pdf);
  if (!size.ok) return size;
  const fileKey = `imports/${actor.schoolId}/${deps.ids.next()}.pdf`;
  const stored = await deps.files.put(fileKey, { bytes: pdf, contentType: 'application/pdf' });
  if (!stored.ok) return fail('storage_unavailable');
  return ok(
    await deps.jobs.enqueue({
      schoolId: actor.schoolId,
      ownerId: actor.id,
      kind: job.kind,
      payload: { ...job.data, fileKey, language: actor.language },
    }),
  );
}

const queueImport = (deps: QueueDeps, actor: User, pdf: Uint8Array, target: ImportTarget) =>
  queuePdfJob(deps, actor, pdf, { kind: pdfImportJobKind, data: target });

/** A job's PDF as text, used and then removed whatever happens; a scan has no text. */
export async function withPdfText<T>(
  deps: { readonly files: FileStore; readonly pdfText: PdfTextExtractor },
  fileKey: string,
  use: (text: string) => Promise<Result<T, { readonly code: JobFailure }>>,
): Promise<Result<T, { readonly code: JobFailure }>> {
  try {
    const file = await deps.files.get(fileKey);
    if (!file.ok) return err({ code: 'failed' });
    const pdf = await deps.pdfText.extract(file.value.bytes);
    if (!pdf.ok) return err({ code: 'pdf_unreadable' });
    if (pdf.value.text.trim() === '') return err({ code: 'pdf_no_text' });
    return await use(pdf.value.text);
  } finally {
    await deps.files.delete(fileKey);
  }
}

/**
 * Starts reading a PDF into questions. Needs AI access. The PDF is kept only until the job has
 * read it; nothing is saved to the assignment until the teacher reviews and saves.
 */
export class RequestPdfImport {
  constructor(
    private readonly deps: AssignmentAccessDeps & {
      readonly files: FileStore;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(
    input: AssignmentRef & { readonly pdf: Uint8Array },
  ): Promise<Result<Job, UseCaseError>> {
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    return queueImport(this.deps, input.actor, input.pdf, {
      classId: found.value.cls.id,
      assignmentId: found.value.assignment.id,
    });
  }
}

/**
 * Starts reading a PDF into questions for a Google Forms quiz, with no class. Needs AI access; the
 * questions are only reviewed, never saved in TeacherHubPro.
 */
export class RequestQuizImport {
  constructor(
    private readonly deps: QueueDeps & {
      readonly subscriptions: SubscriptionRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly title: string;
    readonly pdf: Uint8Array;
  }): Promise<Result<Job, UseCaseError>> {
    const access = await checkAiAccess(this.deps, input.actor.schoolId);
    if (!access.ok) return access;
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    return queueImport(this.deps, input.actor, input.pdf, {
      classId: null,
      assignmentId: null,
      title: title.value,
    });
  }
}

/** Reads the PDF's text, has the AI split it into questions, and removes the PDF. */
export class PdfImportHandler implements JobHandler {
  readonly kind = pdfImportJobKind;

  constructor(
    private readonly deps: {
      readonly files: FileStore;
      readonly pdfText: PdfTextExtractor;
      readonly questionExtractor: QuestionExtractor;
    },
  ) {}

  async handle(job: Job): Promise<Result<ImportedTest, { readonly code: JobFailure }>> {
    const payload = job.payload as PdfImportPayload;
    return withPdfText(this.deps, payload.fileKey, async (text) => {
      const test = await this.deps.questionExtractor.extract({ text, language: payload.language });
      if (!test.ok) return test;
      const target: ImportTarget =
        payload.classId === null
          ? { classId: null, assignmentId: null, title: payload.title }
          : { classId: payload.classId, assignmentId: payload.assignmentId };
      return ok({ ...target, test: test.value });
    });
  }
}

/** The questions from the actor's finished import, for the editor to show before saving. */
export class GetImportedTest {
  constructor(private readonly deps: { readonly jobs: JobQueue }) {}

  async execute(input: { actor: User; jobId: JobId }): Promise<Result<ImportedTest, UseCaseError>> {
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job?.kind !== pdfImportJobKind || job.status !== 'completed') return fail('not_found');
    return ok(job.result as ImportedTest);
  }
}
