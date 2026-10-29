import type { Clock } from '@thp/ports';

/** A Clock for tests: time stands still until the test advances it. */
export class FixedClock implements Clock {
  private current: number;

  constructor(start: Date) {
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceBy(milliseconds: number): void {
    this.current += milliseconds;
  }
}
