import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@thp/domain';
import { monthCalendar, monthOf, shiftMonth } from './plan-calendar.ts';

const d = (value: string) => value as LocalDate;

describe('monthCalendar', () => {
  it('lays a month out in Monday-to-Sunday weeks', () => {
    const weeks = monthCalendar('2026-09', []);

    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toEqual({ date: '2026-08-31', inMonth: false, planIds: [] });
    expect(weeks[0]?.[1]?.date).toBe('2026-09-01');
    expect(weeks.at(-1)?.at(-1)).toMatchObject({ date: '2026-10-04', inMonth: false });
  });

  it('puts each plan on every day it covers', () => {
    const weeks = monthCalendar('2026-09', [
      { id: 'a', start: d('2026-09-07'), end: d('2026-09-11') },
      { id: 'b', start: d('2026-09-11'), end: d('2026-09-11') },
    ]);
    const day = (date: string) => weeks.flat().find((cell) => cell.date === date)?.planIds;

    expect(day('2026-09-06')).toEqual([]);
    expect(day('2026-09-07')).toEqual(['a']);
    expect(day('2026-09-11')).toEqual(['a', 'b']);
    expect(day('2026-09-12')).toEqual([]);
  });

  it('starts on the 1st when the month starts on a Monday', () => {
    expect(monthCalendar('2027-02', [])[0]?.[0]?.date).toBe('2027-02-01');
    expect(monthCalendar('2027-02', [])).toHaveLength(4);
  });

  it('is empty for a malformed month', () => {
    expect(monthCalendar('2026-13', [])).toEqual([]);
  });
});

describe('months', () => {
  it('moves across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('reads the month from a link, or uses today’s', () => {
    expect(monthOf('2026-10', d('2026-09-15'))).toBe('2026-10');
    expect(monthOf('2026-1', d('2026-09-15'))).toBe('2026-09');
    expect(monthOf(undefined, d('2026-09-15'))).toBe('2026-09');
  });
});
