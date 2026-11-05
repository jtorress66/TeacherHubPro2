import type { Delay } from '@thp/ports';

/** A Delay for tests: never sleeps, and records each wait. */
export class FakeDelay implements Delay {
  readonly waits: number[] = [];

  wait(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
    return Promise.resolve();
  }
}
