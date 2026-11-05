import { describe, expect, it } from 'vitest';
import type { Delay } from '@thp/ports';

/** Shared suite every Delay implementation must pass. */
export function delayContract(name: string, makeDelay: () => Delay): void {
  describe(`${name} (Delay contract)`, () => {
    it('resolves once the wait is over', async () => {
      await expect(makeDelay().wait(1)).resolves.toBeUndefined();
    });
  });
}
