import type { JobId, SchoolId, UserId } from '@thp/domain';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

/** Long AI work (generation, PDF parsing, grading, prep batches) runs as a stored job. */
export interface Job {
  readonly id: JobId;
  readonly schoolId: SchoolId;
  readonly ownerId: UserId;
  readonly kind: string;
  readonly payload: unknown;
  readonly status: JobStatus;
  readonly result: unknown;
  readonly error: string | null;
  readonly attempts: number;
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
}

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
  /** Users can read only their own jobs. */
  findForOwner(schoolId: SchoolId, ownerId: UserId, id: JobId): Promise<Job | null>;
}
