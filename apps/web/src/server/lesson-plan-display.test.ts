import { describe, expect, it } from 'vitest';
import type { LocalDate } from '@thp/domain';
import { aLessonPlan } from '@thp/testing';
import { mondayOf, nextMonday, nextStartOf, planDates, planName } from './lesson-plan-display.ts';

const d = (value: string) => value as LocalDate;

describe('dates', () => {
  it('finds the next Monday and the Monday of a week', () => {
    expect(nextMonday(d('2026-09-02'))).toBe('2026-09-07');
    expect(nextMonday(d('2026-09-07'))).toBe('2026-09-14');
    expect(nextMonday(d('2026-09-06'))).toBe('2026-09-07');
    expect(mondayOf(d('2026-09-06'))).toBe('2026-08-31');
    expect(mondayOf(d('2026-09-07'))).toBe('2026-09-07');
  });
});

describe('plan display', () => {
  const weekly = aLessonPlan();
  const ce = aLessonPlan({
    title: 'Café',
    body: { kind: 'conversational_english', lessonDate: '2026-09-08' },
  });

  it('shows a week as a range and a one-day lesson as one date', () => {
    expect(planDates(weekly, 'en')).toBe('Sep 7, 2026 – Sep 11, 2026');
    expect(planDates(ce, 'en')).toBe('Sep 8, 2026');
    expect(planDates(weekly, 'es')).toMatch(/7 sept 2026 – 11 sept 2026/);
  });

  it('names a plan by its title, unit or kind', () => {
    expect(planName(ce, 'en')).toBe('Café');
    expect(planName(weekly, 'es')).toBe('Plan semanal');
    expect(
      planName(
        aLessonPlan({
          body: { kind: 'weekly', unit: 'Fractions', weeks: [{ weekStart: '2026-09-07' }] },
        }),
        'en',
      ),
    ).toBe('Fractions');
  });

  it('suggests the following week for a duplicate', () => {
    expect(nextStartOf(weekly)).toBe('2026-09-14');
  });
});
