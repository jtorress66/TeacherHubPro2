import type { Job, JobProgress, JobStatus } from '@thp/domain';
import type { Locale } from '@thp/i18n';
import { draftFailureMessage } from './planner-messages.ts';

/** What a job's owner polls: the status, a running job's progress, a failed job's safe message. */
export interface JobStatusReply {
  readonly status: JobStatus;
  readonly message?: string;
  readonly progress?: JobProgress;
}

export function jobStatusReply(job: Job, locale: Locale): JobStatusReply {
  const { status, error, progress } = job;
  if (status === 'failed') return { status, message: draftFailureMessage(error, locale) };
  return status === 'running' && progress !== null ? { status, progress } : { status };
}
