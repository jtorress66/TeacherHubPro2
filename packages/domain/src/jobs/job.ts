import type { JobId, SchoolId, UserId } from '../shared/ids.ts';

export const jobStatuses = ['queued', 'running', 'completed', 'failed'] as const;

export type JobStatus = (typeof jobStatuses)[number];

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

/** Safe reasons shown to the user; raw errors are never stored. */
export const jobFailures = [
  'timed_out',
  'ai_unavailable',
  'invalid_output',
  'unknown_kind',
  'failed',
] as const;

export type JobFailure = (typeof jobFailures)[number];

/** A job not finished this long after it was created has failed. */
export const jobTimeoutMs = 5 * 60 * 1000;

export const isFinished = (job: Job): boolean =>
  job.status === 'completed' || job.status === 'failed';

export const isStale = (job: Job, now: Date): boolean =>
  !isFinished(job) && now.getTime() - job.createdAt.getTime() > jobTimeoutMs;

/** The cut-off: unfinished jobs created before it are stale. */
export const staleBefore = (now: Date): Date => new Date(now.getTime() - jobTimeoutMs);

/** How the job looks to its owner: a stale job reads as failed even before the sweep stores it. */
export const jobAsSeen = (job: Job, now: Date): Job =>
  isStale(job, now)
    ? { ...job, status: 'failed', error: 'timed_out' satisfies JobFailure, finishedAt: now }
    : job;
