import { describe, expect, it } from 'vitest';
import { err, ok, type JobId, type SchoolId, type UserId } from '@thp/domain';
import type { JobQueue } from '@thp/ports';
import { aUser } from '@thp/testing';
import {
  GetJob,
  JobHandlerRegistry,
  RunNextJob,
  SweepStaleJobs,
  type JobHandler,
} from '../src/index.ts';
import { colleagueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

const owner = aUser();
const handler = (outcome: JobHandler['handle']): JobHandler => ({ kind: 'echo', handle: outcome });
const enqueue = (world: World, kind = 'echo') =>
  world.jobs.enqueue({ schoolId: owner.schoolId, ownerId: owner.id, kind, payload: { n: 1 } });
const read = (world: World, id: JobId) => world.jobs.findForOwner(owner.schoolId, owner.id, id);

describe('RunNextJob', () => {
  it('is idle when nothing is queued', async () => {
    const world = makeWorld();
    const run = new RunNextJob({ jobs: world.jobs, handlers: new JobHandlerRegistry([]) });
    expect(await run.execute()).toBe('idle');
  });

  it('stores the handler’s result', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    const handlers = new JobHandlerRegistry([
      handler((claimed) => Promise.resolve(ok({ echoed: claimed.payload }))),
    ]);

    expect(await new RunNextJob({ jobs: world.jobs, handlers }).execute()).toBe('completed');
    expect(await read(world, job.id)).toMatchObject({
      status: 'completed',
      result: { echoed: { n: 1 } },
      attempts: 1,
    });
  });

  it('stores a handler’s failure code', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    const handlers = new JobHandlerRegistry([
      handler(() => Promise.resolve(err({ code: 'ai_unavailable' }))),
    ]);

    expect(await new RunNextJob({ jobs: world.jobs, handlers }).execute()).toBe('failed');
    expect(await read(world, job.id)).toMatchObject({ status: 'failed', error: 'ai_unavailable' });
  });

  it('never stores the message of a handler that throws', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    const handlers = new JobHandlerRegistry([
      handler(() => Promise.reject(new Error('secret prompt text'))),
    ]);

    await new RunNextJob({ jobs: world.jobs, handlers }).execute();
    expect(await read(world, job.id)).toMatchObject({ status: 'failed', error: 'failed' });
  });

  it('only claims kinds it has a handler for', async () => {
    const world = makeWorld();
    const other = await enqueue(world, 'grading');
    const handlers = new JobHandlerRegistry([handler(() => Promise.resolve(ok(null)))]);

    expect(handlers.kinds).toEqual(['echo']);
    expect(await new RunNextJob({ jobs: world.jobs, handlers }).execute()).toBe('idle');
    expect((await read(world, other.id))?.status).toBe('queued');
  });

  it('fails a claimed job whose kind has no handler', async () => {
    const world = makeWorld();
    const job = await enqueue(world, 'grading');
    const claimed = await world.jobs.findForOwner(owner.schoolId, owner.id, job.id);
    if (claimed === null) throw new Error('job not saved');
    const jobs: JobQueue = {
      enqueue: (next) => world.jobs.enqueue(next),
      claimNext: () => Promise.resolve(claimed),
      complete: (id, result) => world.jobs.complete(id, result),
      fail: (id, error) => world.jobs.fail(id, error),
      failStale: (before, error) => world.jobs.failStale(before, error),
      findForOwner: (schoolId, ownerId, id) => world.jobs.findForOwner(schoolId, ownerId, id),
    };

    expect(await new RunNextJob({ jobs, handlers: new JobHandlerRegistry([]) }).execute()).toBe(
      'failed',
    );
    expect(await read(world, job.id)).toMatchObject({ status: 'failed', error: 'unknown_kind' });
  });
});

describe('SweepStaleJobs', () => {
  it('fails jobs left unfinished for more than 5 minutes', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    world.clock.advanceBy(5 * 60_000);
    expect(await new SweepStaleJobs(world).execute()).toBe(0);

    world.clock.advanceBy(1);
    expect(await new SweepStaleJobs(world).execute()).toBe(1);
    expect(await read(world, job.id)).toMatchObject({ status: 'failed', error: 'timed_out' });
  });
});

describe('GetJob', () => {
  it('shows the owner their job, as often as they ask, without changing it', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    const get = () => new GetJob(world).execute({ actor: owner, jobId: job.id });

    expect(await get()).toEqual(ok(job));
    expect(await get()).toEqual(ok(job));
  });

  it('shows a job past its time limit as timed out before the sweep stores it', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    world.clock.advanceBy(6 * 60_000);

    const seen = await new GetJob(world).execute({ actor: owner, jobId: job.id });
    expect(seen.ok && seen.value).toMatchObject({ status: 'failed', error: 'timed_out' });
    expect((await read(world, job.id))?.status).toBe('queued');
  });

  it('does not find another teacher’s or another school’s job', async () => {
    const world = makeWorld();
    const job = await enqueue(world);
    const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId });

    for (const actor of [colleagueOf(owner), colleagueOf(owner, 'school_admin'), outsider]) {
      expect(await new GetJob(world).execute({ actor, jobId: job.id })).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
    }
  });
});
