import { describe, expect, it } from 'vitest';
import type { Job, JobId, SchoolId, UserId } from '@thp/domain';
import { jobStatusReply } from './job-status.ts';
import { draftFailureMessage } from './planner-messages.ts';

const job = (changes: Partial<Job> = {}): Job => ({
  id: 'job-1' as JobId,
  schoolId: 'school-1' as SchoolId,
  ownerId: 'teacher-1' as UserId,
  kind: 'assistant.generate',
  payload: { topic: 'Rain' },
  status: 'running',
  result: null,
  error: null,
  attempts: 1,
  createdAt: new Date('2026-11-15T10:00:00Z'),
  startedAt: new Date('2026-11-15T10:00:01Z'),
  finishedAt: null,
  progress: null,
  ...changes,
});

describe('jobStatusReply', () => {
  it('sends only the status of a job without progress', () => {
    expect(jobStatusReply(job(), 'en')).toEqual({ status: 'running' });
    expect(jobStatusReply(job({ status: 'completed', result: { id: 'g' } }), 'en')).toEqual({
      status: 'completed',
    });
  });

  it('sends the progress of a running job', () => {
    const progress = { from: 26, to: 50, total: 75 };
    expect(jobStatusReply(job({ progress }), 'en')).toEqual({ status: 'running', progress });
  });

  it('sends a failed job’s safe message in the teacher’s language, never the payload', () => {
    const reply = jobStatusReply(
      job({ status: 'failed', error: 'invalid_output', progress: { from: 1, to: 25, total: 50 } }),
      'es',
    );
    expect(reply).toEqual({ status: 'failed', message: draftFailureMessage('invalid_output', 'es') });
  });
});
