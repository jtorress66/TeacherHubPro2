import { expect, it } from 'vitest';
import { clockContract } from './contracts/clock.contract.ts';
import { FixedClock } from './fixed-clock.ts';

clockContract('FixedClock', () => new FixedClock(new Date('2026-09-01T08:00:00Z')));

it('returns the time it was set to until advanced', () => {
  const clock = new FixedClock(new Date('2026-09-01T08:00:00Z'));

  expect(clock.now().toISOString()).toBe('2026-09-01T08:00:00.000Z');
  clock.advanceBy(60_000);
  expect(clock.now().toISOString()).toBe('2026-09-01T08:01:00.000Z');
});
