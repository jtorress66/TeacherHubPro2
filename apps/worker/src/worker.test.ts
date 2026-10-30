import { describe, expect, it } from 'vitest';
import { createDraftRequest } from '@thp/domain';
import { LessonPlanner } from '@thp/agents';
import { LocalLlmClient } from '@thp/adapters';
import { unwrap } from '@thp/testing';
import type { JobRun } from '@thp/application';
import { localPlannerReply } from './local-planner-reply.ts';
import { runWorkerLoop } from './worker-loop.ts';

describe('runWorkerLoop', () => {
  const loop = (runs: (JobRun | Error)[], ticks = runs.length) => {
    const events: string[] = [];
    let clock = 0;
    let left = ticks;
    const promise = runWorkerLoop({
      runNext: () => {
        left--;
        const next = runs.shift() ?? 'idle';
        events.push(next instanceof Error ? 'error' : next);
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      },
      sweep: () => {
        events.push('sweep');
        return Promise.resolve(0);
      },
      sleep: (ms) => {
        events.push(`sleep ${String(ms)}`);
        clock += ms;
        return Promise.resolve();
      },
      now: () => clock,
      stopped: () => left <= 0,
      idleMs: 1000,
      sweepEveryMs: 2000,
      onError: () => events.push('reported'),
    });
    return promise.then(() => events);
  };

  it('runs jobs back to back and waits only when idle', async () => {
    expect(await loop(['completed', 'failed', 'idle'])).toEqual([
      'sweep',
      'completed',
      'failed',
      'idle',
      'sleep 1000',
    ]);
  });

  it('sweeps stale jobs again once the interval has passed', async () => {
    expect(await loop(['idle', 'idle', 'idle'])).toEqual([
      'sweep',
      'idle',
      'sleep 1000',
      'idle',
      'sleep 1000',
      'sweep',
      'idle',
      'sleep 1000',
    ]);
  });

  it('reports a broken iteration and keeps going after a pause', async () => {
    expect(await loop([new Error('db down'), 'completed'])).toEqual([
      'sweep',
      'error',
      'reported',
      'sleep 1000',
      'completed',
    ]);
  });
});

describe('the local planner reply', () => {
  const request = (kind: string, subject: string | null) =>
    unwrap(
      createDraftRequest({
        kind,
        subject,
        grade: '4',
        topic: 'Fractions',
        language: 'en',
        start: '2026-09-07',
      }),
    );

  it('drafts a valid weekly plan citing an offered code', async () => {
    const draft = unwrap(
      await new LessonPlanner(new LocalLlmClient(localPlannerReply)).draft(
        request('weekly', 'math'),
      ),
    );
    expect(draft.kind === 'weekly' && draft.standards[0]).toMatch(/^CCSS\.Math/);
    expect(draft.kind === 'weekly' && draft.days).toHaveLength(5);
  });

  it('drafts a Conversational English lesson', async () => {
    const draft = unwrap(
      await new LessonPlanner(new LocalLlmClient(localPlannerReply)).draft(
        request('conversational_english', null),
      ),
    );
    expect(draft).toMatchObject({ kind: 'conversational_english', title: 'Local draft lesson' });
  });

  it('cites nothing when no code is offered', () => {
    expect(JSON.parse(localPlannerReply({ system: '', messages: [], maxTokens: 1 }))).toMatchObject(
      { standards: [] },
    );
  });
});
