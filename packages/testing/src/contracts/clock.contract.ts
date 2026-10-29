import { describe, expect, it } from 'vitest';
import type { Clock } from '@thp/ports';

/** Shared suite every Clock implementation must pass. */
export function clockContract(name: string, makeClock: () => Clock): void {
  describe(`${name} (Clock contract)`, () => {
    it('returns a valid Date', () => {
      const now = makeClock().now();

      expect(now).toBeInstanceOf(Date);
      expect(Number.isNaN(now.getTime())).toBe(false);
    });

    it('never goes backwards between calls', () => {
      const clock = makeClock();
      const first = clock.now();
      const second = clock.now();

      expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
    });

    it('returns a copy callers cannot mutate', () => {
      const clock = makeClock();
      const before = clock.now().getTime();
      clock.now().setFullYear(1900);

      expect(clock.now().getTime()).toBeGreaterThanOrEqual(before);
    });
  });
}
