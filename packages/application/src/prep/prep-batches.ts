import {
  createPrepRequest,
  editEmail,
  err,
  finishBatch,
  invalid,
  jobAsSeen,
  nextPending,
  ok,
  prepProgress,
  recordDone,
  recordFailed,
  retryBatch,
  selectItems,
  startBatch,
  type Job,
  type JobFailure,
  type JobId,
  type ParentEmail,
  type PrepBatch,
  type PrepBatchId,
  type PrepProgress,
  type PrepRequestInput,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  GradeCategoryRepository,
  IdGenerator,
  JobQueue,
  PrepBatchRepository,
  StudentRepository,
  SubscriptionRepository,
} from '@thp/ports';
import { checkAiAccess } from '../accounts/ai-access.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import type { JobHandler } from '../jobs/jobs.ts';
import type { PrepRunners } from './prep-runners.ts';

export const prepStepJobKind = 'prep.step';

interface PrepStepPayload {
  readonly batchId: PrepBatchId;
}

interface BatchRef {
  readonly actor: User;
  readonly batchId: PrepBatchId;
}

interface Batches {
  readonly prepBatches: PrepBatchRepository;
}

/** The actor's own batch; anyone else's, a school admin's included, is not found. */
async function findBatch(
  deps: Batches,
  { actor, batchId }: BatchRef,
): Promise<Result<PrepBatch, UseCaseError>> {
  const batch = await deps.prepBatches.find(actor.schoolId, actor.id, batchId);
  return batch === null ? fail('not_found') : ok(batch);
}

const queueStep = (jobs: JobQueue, batch: PrepBatch): Promise<Job> =>
  jobs.enqueue({
    schoolId: batch.schoolId,
    ownerId: batch.teacherId,
    kind: prepStepJobKind,
    payload: { batchId: batch.id } satisfies PrepStepPayload,
  });

/**
 * Starts a week of prep for a class the actor manages. Needs AI access. Each item is drafted by
 * its own job, so no job comes near the job time limit; nothing is saved until the teacher
 * publishes.
 */
export class StartPrepBatch {
  constructor(
    private readonly deps: Batches & {
      readonly jobs: JobQueue;
      readonly subscriptions: SubscriptionRepository;
      readonly classes: ClassRepository;
      readonly gradeCategories: GradeCategoryRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    actor: User;
    request: PrepRequestInput;
  }): Promise<Result<PrepBatch, UseCaseError>> {
    const { actor } = input;
    const access = await checkAiAccess(this.deps, actor);
    if (!access.ok) return access;
    const request = createPrepRequest(input.request);
    if (!request.ok) return request;
    const cls = await findEditableClass(this.deps.classes, actor, request.value.classId);
    if (!cls.ok) return cls;
    const categoryId = request.value.quizCategoryId;
    if (categoryId !== null) {
      const category = await this.deps.gradeCategories.findById(actor.schoolId, categoryId);
      if (category?.classId !== cls.value.id) return invalid('quizCategoryId', 'not_allowed');
    }
    const started = startBatch({
      id: this.deps.ids.next() as PrepBatchId,
      schoolId: actor.schoolId,
      teacherId: actor.id,
      request: request.value,
      jobId: '' as JobId,
      createdAt: this.deps.clock.now(),
    });
    const job = await queueStep(this.deps.jobs, started);
    const batch = { ...started, jobId: job.id };
    await this.deps.prepBatches.save(batch);
    return ok(batch);
  }
}

/**
 * Drafts the batch's next item, then queues the step after it, or finishes the batch with the
 * parent email draft. A failed item is skipped; a failed plan fails the batch.
 */
export class PrepStepHandler implements JobHandler {
  readonly kind = prepStepJobKind;

  constructor(
    private readonly deps: Batches & {
      readonly jobs: JobQueue;
      readonly clock: Clock;
      readonly runners: PrepRunners;
    },
  ) {}

  async handle(job: Job): Promise<Result<PrepStepPayload, { readonly code: JobFailure }>> {
    const { batchId } = job.payload as PrepStepPayload;
    const found = await this.deps.prepBatches.find(job.schoolId, job.ownerId, batchId);
    if (found === null) return err({ code: 'failed' });
    let batch = await this.runNext(found);
    if (batch.status === 'running') {
      if (nextPending(batch) === null) {
        batch = finishBatch(batch, this.deps.clock.now());
      } else {
        const next = await queueStep(this.deps.jobs, batch);
        batch = { ...batch, jobId: next.id };
      }
    }
    await this.deps.prepBatches.save(batch);
    return ok({ batchId });
  }

  private async runNext(batch: PrepBatch): Promise<PrepBatch> {
    const item = nextPending(batch);
    if (item === null) return batch;
    const runner = this.deps.runners[item.kind];
    const content = await runner.run(batch, item);
    return content.ok ? recordDone(batch, item.key, content.value) : recordFailed(batch, item.key);
  }
}

/** Whether a running batch's step job has failed or timed out. */
async function isStalled(
  deps: { readonly jobs: JobQueue; readonly clock: Clock },
  batch: PrepBatch,
): Promise<boolean> {
  if (batch.status !== 'running') return false;
  const job = await deps.jobs.findForOwner(batch.schoolId, batch.teacherId, batch.jobId);
  return job === null || jobAsSeen(job, deps.clock.now()).status === 'failed';
}

/** Queues a stalled batch's step again, or runs a failed batch again from its plan. */
export class ResumePrepBatch {
  constructor(
    private readonly deps: Batches & { readonly jobs: JobQueue; readonly clock: Clock },
  ) {}

  async execute(input: BatchRef): Promise<Result<PrepBatch, UseCaseError>> {
    const found = await findBatch(this.deps, input);
    if (!found.ok) return found;
    let batch = found.value;
    if (batch.status === 'failed') {
      const retried = retryBatch(batch);
      if (!retried.ok) return retried;
      batch = retried.value;
    } else if (!(await isStalled(this.deps, batch))) {
      return invalid('status', 'not_allowed');
    }
    const job = await queueStep(this.deps.jobs, batch);
    const resumed = { ...batch, jobId: job.id };
    await this.deps.prepBatches.save(resumed);
    return ok(resumed);
  }
}

export interface PrepBatchView {
  readonly batch: PrepBatch;
  readonly progress: PrepProgress;
  /** The step job failed or timed out: the teacher can resume. */
  readonly stalled: boolean;
  /** How many families would get the parent email. */
  readonly recipients: number;
}

/** The distinct parent emails on the class roster. */
export async function parentEmails(
  students: StudentRepository,
  batch: PrepBatch,
): Promise<readonly string[]> {
  const roster = await students.listByClass(batch.schoolId, batch.classId);
  return [...new Set(roster.flatMap((s) => (s.parentEmail === null ? [] : [s.parentEmail])))];
}

export class GetPrepBatch {
  constructor(
    private readonly deps: Batches & {
      readonly jobs: JobQueue;
      readonly clock: Clock;
      readonly students: StudentRepository;
    },
  ) {}

  async execute(input: BatchRef): Promise<Result<PrepBatchView, UseCaseError>> {
    const found = await findBatch(this.deps, input);
    if (!found.ok) return found;
    const batch = found.value;
    return ok({
      batch,
      progress: prepProgress(batch),
      stalled: await isStalled(this.deps, batch),
      recipients: (await parentEmails(this.deps.students, batch)).length,
    });
  }
}

export const maxListedPrepBatches = 20;

export class ListPrepBatches {
  constructor(private readonly deps: Batches) {}

  execute(input: { actor: User }): Promise<readonly PrepBatch[]> {
    return this.deps.prepBatches.listForTeacher(
      input.actor.schoolId,
      input.actor.id,
      maxListedPrepBatches,
    );
  }
}

/** Batches waiting for the actor's review, for the menu badge and the dashboard. */
export class CountReadyPrepBatches {
  constructor(private readonly deps: Batches) {}

  execute(input: { actor: User }): Promise<number> {
    return this.deps.prepBatches.countReady(input.actor.schoolId, input.actor.id);
  }
}

/** The teacher picks the items to publish and edits the parent email. */
export class UpdatePrepSelection {
  constructor(private readonly deps: Batches) {}

  async execute(
    input: BatchRef & { keep: readonly string[]; email?: ParentEmail },
  ): Promise<Result<PrepBatch, UseCaseError>> {
    const found = await findBatch(this.deps, input);
    if (!found.ok) return found;
    const selected = selectItems(found.value, input.keep);
    if (!selected.ok) return selected;
    const edited = input.email === undefined ? selected : editEmail(selected.value, input.email);
    if (!edited.ok) return edited;
    await this.deps.prepBatches.save(edited.value);
    return edited;
  }
}

export class DeletePrepBatch {
  constructor(private readonly deps: Batches) {}

  async execute(input: BatchRef): Promise<Result<true, UseCaseError>> {
    const deleted = await this.deps.prepBatches.delete(
      input.actor.schoolId,
      input.actor.id,
      input.batchId,
    );
    return deleted ? ok(true) : fail('not_found');
  }
}
