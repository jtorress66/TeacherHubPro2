import {
  jobAsSeen,
  staleBefore,
  type Job,
  type JobFailure,
  type JobId,
  type Result,
  type User,
} from '@thp/domain';
import type { Clock, JobQueue } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

/** Does one kind of job. A new kind of background work is a new handler, registered once. */
export interface JobHandler {
  readonly kind: string;
  handle(job: Job): Promise<Result<unknown, { readonly code: JobFailure }>>;
}

export class JobHandlerRegistry {
  private readonly handlers: ReadonlyMap<string, JobHandler>;

  constructor(handlers: readonly JobHandler[]) {
    this.handlers = new Map(handlers.map((handler) => [handler.kind, handler]));
  }

  get kinds(): readonly string[] {
    return [...this.handlers.keys()];
  }

  find(kind: string): JobHandler | null {
    return this.handlers.get(kind) ?? null;
  }
}

export type JobRun = 'idle' | 'completed' | 'failed';

/**
 * Takes the next job and runs its handler. Failures are stored as safe codes; a handler that
 * throws fails the job as `failed`, and its error never reaches the user or the log.
 */
export class RunNextJob {
  constructor(
    private readonly deps: { readonly jobs: JobQueue; readonly handlers: JobHandlerRegistry },
  ) {}

  async execute(): Promise<JobRun> {
    const job = await this.deps.jobs.claimNext(this.deps.handlers.kinds);
    if (job === null) return 'idle';
    const handler = this.deps.handlers.find(job.kind);
    const outcome = await this.run(handler, job);
    if (outcome.ok) {
      await this.deps.jobs.complete(job.id, outcome.value);
      return 'completed';
    }
    await this.deps.jobs.fail(job.id, outcome.error.code);
    return 'failed';
  }

  private async run(
    handler: JobHandler | null,
    job: Job,
  ): Promise<Result<unknown, { readonly code: JobFailure }>> {
    if (handler === null) return { ok: false, error: { code: 'unknown_kind' } };
    try {
      return await handler.handle(job);
    } catch {
      return { ok: false, error: { code: 'failed' } };
    }
  }
}

/** Stores the failure of jobs left unfinished too long (a crashed or stopped worker). */
export class SweepStaleJobs {
  constructor(private readonly deps: { readonly jobs: JobQueue; readonly clock: Clock }) {}

  execute(): Promise<number> {
    return this.deps.jobs.failStale(staleBefore(this.deps.clock.now()), 'timed_out');
  }
}

/**
 * A job as its owner sees it. Reading changes nothing, so polling may repeat freely; a job past
 * its time limit reads as timed out. Anyone else's job is not found.
 */
export class GetJob {
  constructor(private readonly deps: { readonly jobs: JobQueue; readonly clock: Clock }) {}

  async execute(input: { actor: User; jobId: JobId }): Promise<Result<Job, UseCaseError>> {
    const job = await this.deps.jobs.findForOwner(
      input.actor.schoolId,
      input.actor.id,
      input.jobId,
    );
    if (job === null) return fail('not_found');
    return { ok: true, value: jobAsSeen(job, this.deps.clock.now()) };
  }
}
