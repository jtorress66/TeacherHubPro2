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

    it('users can read only their own jobs', async () => {
      const queue = make();
      const job = await queue.enqueue(newJob());

      expect(await queue.findForOwner(schoolId, 'someone-else' as UserId, job.id)).toBeNull();
      expect(await queue.findForOwner('school-b' as SchoolId, ownerId, job.id)).toBeNull();
      expect(await queue.findForOwner(schoolId, ownerId, 'missing' as JobId)).toBeNull();
    });
  });
}
