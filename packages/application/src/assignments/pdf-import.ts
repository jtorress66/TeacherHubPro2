import {
  err,
  maxAttachmentBytes,
  ok,
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

interface PdfImportPayload {
  readonly fileKey: string;
  readonly language: Language;
  readonly classId: ClassId;
  readonly assignmentId: AssignmentId;
}

/** What a finished import offers the teacher: the questions to review, and where they go. */
export interface ImportedTest {
  readonly test: ExtractedTest;
  readonly classId: ClassId;
  readonly assignmentId: AssignmentId;
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
    if (input.pdf.length === 0 || input.pdf.length > maxAttachmentBytes) {
      return { ok: false, error: { field: 'pdf', code: 'too_large' } };
    }
    const fileKey = `imports/${input.actor.schoolId}/${this.deps.ids.next()}.pdf`;
    const stored = await this.deps.files.put(fileKey, {
      bytes: input.pdf,
      contentType: 'application/pdf',
    });
    if (!stored.ok) return fail('storage_unavailable');
    const payload: PdfImportPayload = {
      fileKey,
      language: input.actor.language,
      classId: found.value.cls.id,
      assignmentId: found.value.assignment.id,
    };
    return ok(
      await this.deps.jobs.enqueue({
        schoolId: input.actor.schoolId,
        ownerId: input.actor.id,
        kind: pdfImportJobKind,
        payload,
      }),
    );
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
    try {
      const file = await this.deps.files.get(payload.fileKey);
      if (!file.ok) return err({ code: 'failed' });
      const pdf = await this.deps.pdfText.extract(file.value.bytes);
      if (!pdf.ok) return err({ code: 'pdf_unreadable' });
      if (pdf.value.text.trim() === '') return err({ code: 'pdf_no_text' });
      const test = await this.deps.questionExtractor.extract({
        text: pdf.value.text,
        language: payload.language,
      });
      if (!test.ok) return test;
      return ok({ test: test.value, classId: payload.classId, assignmentId: payload.assignmentId });
    } finally {
      await this.deps.files.delete(payload.fileKey);
    }
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
