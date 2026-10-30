import { describe, expect, it } from 'vitest';
import type { JobId, SchoolId, UserId } from '@thp/domain';
import type { JobQueue } from '@thp/ports';

const schoolId = 'school-a' as SchoolId;
const ownerId = 'teacher-1' as UserId;
const newJob = (kind = 'lesson_plan') => ({
  schoolId,
  ownerId,
  kind,
  payload: { topic: 'fractions' },
});

/** Shared suite every JobQueue implementation must pass. */
export function jobQueueContract(name: string, make: () => JobQueue): void {
  describe(`${name} (JobQueue contract)`, () => {
    it('enqueues a job as queued', async () => {
      const job = await make().enqueue(newJob());

      expect(job).toMatchObject({
        ...newJob(),
        status: 'queued',
        attempts: 0,
        result: null,
        error: null,
      });
    });

    it('claims the oldest queued job of the requested kinds, once', async () => {
      const queue = make();
      const first = await queue.enqueue(newJob());
      await queue.enqueue(newJob('grading'));
      await queue.enqueue(newJob());

      const claimed = await queue.claimNext(['lesson_plan']);
      expect(claimed).toMatchObject({ id: first.id, status: 'running', attempts: 1 });
      expect((await queue.claimNext(['lesson_plan']))?.id).not.toBe(first.id);
      expect(await queue.claimNext(['lesson_plan'])).toBeNull();
    });

    it('completes and fails jobs', async () => {
      const queue = make();
      const done = await queue.enqueue(newJob());
      const broken = await queue.enqueue(newJob());
      await queue.claimNext(['lesson_plan']);
      await queue.claimNext(['lesson_plan']);
      await queue.complete(done.id, { planId: 'p1' });
      await queue.fail(broken.id, 'timed out');

      expect(await queue.findForOwner(schoolId, ownerId, done.id)).toMatchObject({
        status: 'completed',
        result: { planId: 'p1' },
      });
      expect(await queue.findForOwner(schoolId, ownerId, broken.id)).toMatchObject({
        status: 'failed',
        error: 'timed out',
      });
    });

    it('never hands the same job to two claims at once', async () => {
      const queue = make();
      await queue.enqueue(newJob());
      await queue.enqueue(newJob());

      const claims = await Promise.all([1, 2, 3].map(() => queue.claimNext(['lesson_plan'])));
      const ids = claims.flatMap((job) => (job ? [job.id] : []));
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });

    it('fails unfinished jobs created before the cut-off, and nothing else', async () => {
      const queue = make();
      const queued = await queue.enqueue(newJob());
      const running = await queue.enqueue(newJob());
      const done = await queue.enqueue(newJob());
      await queue.claimNext(['lesson_plan']);
      await queue.claimNext(['lesson_plan']);
      await queue.claimNext(['lesson_plan']);
      await queue.complete(done.id, {});

      expect(await queue.failStale(new Date(queued.createdAt.getTime() - 1), 'timed_out')).toBe(0);
      const cutOff = new Date(
        Math.max(queued.createdAt.getTime(), running.createdAt.getTime()) + 1,
      );
      expect(await queue.failStale(cutOff, 'timed_out')).toBe(2);

      for (const job of [queued, running]) {
        expect(await queue.findForOwner(schoolId, ownerId, job.id)).toMatchObject({
          status: 'failed',
          error: 'timed_out',
        });
      }
      expect((await queue.findForOwner(schoolId, ownerId, done.id))?.status).toBe('completed');
    });

    it('users can read only their own jobs', async () => {
      const queue = make();
      const job = await queue.enqueue(newJob());

      expect(await queue.findForOwner(schoolId, 'someone-else' as UserId, job.id)).toBeNull();
      expect(await queue.findForOwner('school-b' as SchoolId, ownerId, job.id)).toBeNull();
      expect(await queue.findForOwner(schoolId, ownerId, 'missing' as JobId)).toBeNull();
    });
  });
}
