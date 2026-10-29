import { describe, expect, it } from 'vitest';
import type { Schedule, TimeOfDay } from '@thp/domain';
import { scheduleSummary } from './schedule-summary.ts';

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  period: null,
  startTime: null,
  endTime: null,
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  ...overrides,
});

describe('scheduleSummary', () => {
  it('shows period, times and days in the page language', () => {
    const full = schedule({
      period: 2,
      startTime: '08:50' as TimeOfDay,
      endTime: '09:40' as TimeOfDay,
      days: ['Mon', 'Wed', 'Fri'],
    });

    expect(scheduleSummary(full, 'en')).toBe('Period 2 · 08:50–09:40 · Mon, Wed, Fri');
    expect(scheduleSummary(full, 'es')).toBe('Periodo 2 · 08:50–09:40 · Lun, Mié, Vie');
  });

  it('leaves out what is not set', () => {
    expect(scheduleSummary(schedule({}), 'en')).toBe('Mon, Tue, Wed, Thu, Fri');
    expect(scheduleSummary(null, 'en')).toBe('');
  });
});
