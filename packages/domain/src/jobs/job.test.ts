import { describe, expect, it } from 'vitest';
import type { JobId, SchoolId, UserId } from '../shared/ids.ts';
import { isFinished, isStale, jobAsSeen, staleBefore, type Job } from './job.ts';

const createdAt = new Date('2026-09-07T12:00:00Z');
const job = (status: Job['status']): Job => ({
  id: 'job-1' as JobId,
  schoolId: 'school-1' as SchoolId,
  ownerId: 'user-1' as UserId,
  kind: 'lesson_plan.draft',
  payload: {},
  status,
  result: null,
  error: null,
  attempts: 0,
  createdAt,
  startedAt: null,
  finishedAt: null,
});
const after = (ms: number) => new Date(createdAt.getTime() + ms);

describe('jobs', () => {
  it('are stale only when unfinished more than 5 minutes after creation', () => {
    expect(isStale(job('queued'), after(5 * 60_000))).toBe(false);
    expect(isStale(job('running'), after(5 * 60_000 + 1))).toBe(true);
    expect(isStale(job('completed'), after(60 * 60_000))).toBe(false);
    expect(isStale(job('failed'), after(60 * 60_000))).toBe(false);
  });

  it('know when they are finished', () => {
    expect(isFinished(job('completed'))).toBe(true);
    expect(isFinished(job('queued'))).toBe(false);
  });

  it('read as timed out once stale, and unchanged before', () => {
    const now = after(6 * 60_000);
    expect(jobAsSeen(job('running'), now)).toMatchObject({
      status: 'failed',
      error: 'timed_out',
      finishedAt: now,
    });
    const fresh = job('running');
    expect(jobAsSeen(fresh, after(1000))).toBe(fresh);
  });

  it('gives the cut-off for the sweep', () => {
    expect(staleBefore(after(5 * 60_000))).toEqual(createdAt);
  });
});
