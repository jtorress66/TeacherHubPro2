import { describe, expect, it } from 'vitest';
import { checkSchedule } from './schedule.ts';

const now = new Date('2026-11-08T12:00:00Z');

describe('checkSchedule', () => {
  it('accepts a time at least 5 minutes ahead and up to a year ahead', () => {
    const at = new Date('2026-11-09T08:00:00Z');
    expect(checkSchedule('scheduledAt', at, now)).toEqual({ ok: true, value: at });
  });

  it('refuses a time in the past or too soon, and one more than a year away', () => {
    expect(checkSchedule('scheduledAt', new Date('2026-11-08T12:03:00Z'), now)).toEqual({
      ok: false,
      error: { field: 'scheduledAt', code: 'out_of_range' },
    });
    expect(checkSchedule('scheduledAt', new Date('2027-11-09T12:00:00Z'), now).ok).toBe(false);
  });
});
