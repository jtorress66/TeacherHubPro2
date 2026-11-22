import {
  err,
  failTranslations,
  familyLanguages,
  finishTranslations,
  ok,
  startTranslations,
  type EmailTranslation,
  type Job,
  type JobFailure,
  type Language,
  type ParentEmail,
  type PrepBatch,
  type PrepBatchId,
  type Result,
} from '@thp/domain';
import type {
  Clock,
  JobQueue,
  MessageTranslator,
  SchoolRepository,
  StudentRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import type { UseCaseError } from '../errors.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import { findBatch, type BatchRef, type Batches } from './prep-batches.ts';

export const translateEmailJobKind = 'prep.translate-email';

interface TranslatePayload {
  readonly batchId: PrepBatchId;
  /** The email as it was when the teacher asked; a changed email drops the drafts. */
  readonly source: ParentEmail;
}

/**
 * Asks the AI to draft the parent email in each language the class's families read, other than
 * the email's own. Needs AI access; the teacher checks the drafts before anything is sent.
 */
export class RequestEmailTranslations {
  constructor(
    private readonly deps: Batches & {
      readonly students: StudentRepository;
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly schools: SchoolRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: BatchRef): Promise<Result<PrepBatch, UseCaseError>> {
    const found = await findBatch(this.deps, input);
    if (!found.ok) return found;
    const access = await checkAiAccess(this.deps, input.actor);
    if (!access.ok) return access;
    const batch = found.value;
    const roster = await this.deps.students.listByClass(batch.schoolId, batch.classId);
    const languages = familyLanguages(roster, batch.request.language).map((f) => f.language);
    const started = startTranslations(batch, languages);
    if (!started.ok) return started;
    const source = started.value.translations?.source;
    if (source === undefined) return started;
    await this.deps.prepBatches.save(started.value);
    await this.deps.jobs.enqueue({
      schoolId: batch.schoolId,
      ownerId: batch.teacherId,
      kind: translateEmailJobKind,
      payload: { batchId: batch.id, source } satisfies TranslatePayload,
    });
    return started;
  }
}

/** Drafts each translation and keeps them on the batch for the teacher to check. */
export class TranslateEmailHandler implements JobHandler {
  readonly kind = translateEmailJobKind;

  constructor(private readonly deps: Batches & { readonly messageTranslator: MessageTranslator }) {}

  async handle(job: Job): Promise<Result<true, { readonly code: JobFailure }>> {
    const { batchId, source } = job.payload as TranslatePayload;
    const batch = await this.deps.prepBatches.find(job.schoolId, job.ownerId, batchId);
    if (batch?.translations?.status !== 'running') return err({ code: 'failed' });
    const items: EmailTranslation[] = [];
    for (const language of batch.translations.languages) {
      const draft = await this.translate(source, batch.request.language, language);
      if (!draft.ok) {
        await this.saveLatest(job, batchId, (latest) => failTranslations(latest, source));
        return draft;
      }
      items.push({ language, ...draft.value });
    }
    await this.saveLatest(job, batchId, (latest) => finishTranslations(latest, source, items));
    return ok(true);
  }

  private translate(email: ParentEmail, from: Language, to: Language) {
    return this.deps.messageTranslator.translate({ email, from, to });
  }

  /** Reads the batch again, so a change the teacher made meanwhile is kept. */
  private async saveLatest(
    job: Job,
    batchId: PrepBatchId,
    change: (batch: PrepBatch) => PrepBatch,
  ): Promise<void> {
    const latest = await this.deps.prepBatches.find(job.schoolId, job.ownerId, batchId);
    if (latest !== null) await this.deps.prepBatches.save(change(latest));
  }
}
