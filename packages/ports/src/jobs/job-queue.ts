import type { Job, JobId, JobProgress, SchoolId, UserId } from '@thp/domain';

export interface NewJob {
  readonly schoolId: SchoolId;
  readonly ownerId: UserId;
  readonly kind: string;
  readonly payload: unknown;
}

/** Lets a running job say how far it has got, for its owner's progress page. */
export interface JobProgressReporter {
  /** Stores the progress of a running job; ignored for a job that is not running. */
  reportProgress(id: JobId, progress: JobProgress): Promise<void>;
}

export interface JobQueue extends JobProgressReporter {
  enqueue(job: NewJob): Promise<Job>;
  /** Atomically takes the oldest queued job of the given kinds and marks it running. */
  claimNext(kinds: readonly string[]): Promise<Job | null>;
  complete(id: JobId, result: unknown): Promise<void>;
  fail(id: JobId, error: string): Promise<void>;
  /** Fails every unfinished job created before the cut-off; returns how many. */
  failStale(createdBefore: Date, error: string): Promise<number>;
  /** Users can read only their own jobs. */
  findForOwner(schoolId: SchoolId, ownerId: UserId, id: JobId): Promise<Job | null>;
}
