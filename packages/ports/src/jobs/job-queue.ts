import type { Job, JobId, SchoolId, UserId } from '@thp/domain';

export interface NewJob {
  readonly schoolId: SchoolId;
  readonly ownerId: UserId;
  readonly kind: string;
  readonly payload: unknown;
}

export interface JobQueue {
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
