import { isFinished, type Job, type JobId, type SchoolId, type UserId } from '@thp/domain';
import type { Clock, IdGenerator, JobQueue, NewJob } from '@thp/ports';

export class InMemoryJobQueue implements JobQueue {
  private readonly jobs: Job[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  enqueue(job: NewJob): Promise<Job> {
    const queued: Job = {
      ...job,
      id: this.ids.next() as JobId,
      status: 'queued',
      result: null,
      error: null,
      attempts: 0,
      createdAt: this.clock.now(),
      startedAt: null,
      finishedAt: null,
    };
    this.jobs.push(queued);
    return Promise.resolve(queued);
  }

  claimNext(kinds: readonly string[]): Promise<Job | null> {
    const next = this.jobs.find((job) => job.status === 'queued' && kinds.includes(job.kind));
    if (next === undefined) return Promise.resolve(null);
    return Promise.resolve(
      this.update(next.id, {
        status: 'running',
        attempts: next.attempts + 1,
        startedAt: this.clock.now(),
      }),
    );
  }

  complete(id: JobId, result: unknown): Promise<void> {
    this.update(id, { status: 'completed', result, finishedAt: this.clock.now() });
    return Promise.resolve();
  }

  fail(id: JobId, error: string): Promise<void> {
    this.update(id, { status: 'failed', error, finishedAt: this.clock.now() });
    return Promise.resolve();
  }

  failStale(createdBefore: Date, error: string): Promise<number> {
    const stale = this.jobs.filter((job) => !isFinished(job) && job.createdAt < createdBefore);
    for (const job of stale)
      this.update(job.id, { status: 'failed', error, finishedAt: this.clock.now() });
    return Promise.resolve(stale.length);
  }

  findForOwner(schoolId: SchoolId, ownerId: UserId, id: JobId): Promise<Job | null> {
    const job = this.jobs.find(
      (j) => j.id === id && j.schoolId === schoolId && j.ownerId === ownerId,
    );
    return Promise.resolve(job ?? null);
  }

  private update(id: JobId, changes: Partial<Job>): Job | null {
    const index = this.jobs.findIndex((job) => job.id === id);
    const current = this.jobs[index];
    if (current === undefined) return null;
    const updated = { ...current, ...changes };
    this.jobs[index] = updated;
    return updated;
  }
}
