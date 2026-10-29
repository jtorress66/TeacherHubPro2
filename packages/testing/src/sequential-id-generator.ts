import type { IdGenerator } from '@thp/ports';

/** An IdGenerator for tests: returns `prefix-1`, `prefix-2`, ... */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.count += 1;
    return `${this.prefix}-${String(this.count)}`;
  }
}
