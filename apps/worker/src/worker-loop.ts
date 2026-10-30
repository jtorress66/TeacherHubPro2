import type { JobRun } from '@thp/application';

export interface WorkerLoopDeps {
  readonly runNext: () => Promise<JobRun>;
  readonly sweep: () => Promise<number>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  /** True once the worker should stop; checked between jobs, so a running job finishes. */
  readonly stopped: () => boolean;
  readonly idleMs?: number;
  readonly sweepEveryMs?: number;
  readonly onError?: (error: unknown) => void;
}

/**
 * Runs jobs one after another, waits when there are none, and sweeps stale jobs once a minute.
 * A broken iteration (for example, the database going away) is reported and retried after a pause.
 */
export async function runWorkerLoop(deps: WorkerLoopDeps): Promise<void> {
  const idleMs = deps.idleMs ?? 1000;
  const sweepEveryMs = deps.sweepEveryMs ?? 60_000;
  let lastSweep = Number.NEGATIVE_INFINITY;

  while (!deps.stopped()) {
    try {
      if (deps.now() - lastSweep >= sweepEveryMs) {
        lastSweep = deps.now();
        await deps.sweep();
      }
      if ((await deps.runNext()) === 'idle') await deps.sleep(idleMs);
    } catch (error) {
      deps.onError?.(error);
      await deps.sleep(idleMs);
    }
  }
}
