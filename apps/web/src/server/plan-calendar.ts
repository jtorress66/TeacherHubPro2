import { addDays, compareDates, parseLocalDate, type LocalDate } from '@thp/domain';

/** A calendar month, written YYYY-MM. */
export type Month = string;

export interface CalendarDay {
  readonly date: LocalDate;
  readonly inMonth: boolean;
  /** The plans whose dates cover this day, in the order given. */
  readonly planIds: readonly string[];
}

export interface PlanDates {
  readonly id: string;
  readonly start: LocalDate;
  readonly end: LocalDate;
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The month asked for, or the fallback's month when the value is missing or malformed. */
export const monthOf = (value: string | undefined, fallback: LocalDate): Month =>
  value !== undefined && monthPattern.test(value) ? value : fallback.slice(0, 7);

export function shiftMonth(month: Month, delta: number): Month {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

const weekdayIndex = (date: LocalDate): number =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Monday-to-Sunday weeks covering the month, with the plans on each day. */
export function monthCalendar(month: Month, plans: readonly PlanDates[]): CalendarDay[][] {
  const first = parseLocalDate('month', `${month}-01`);
  if (!first.ok) return [];
  const start = addDays(first.value, -weekdayIndex(first.value));
  const next = addDays(`${shiftMonth(month, 1)}-01` as LocalDate, 0);
  const weeks: CalendarDay[][] = [];
  for (let monday = start; compareDates(monday, next) < 0; monday = addDays(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const date = addDays(monday, offset);
        return {
          date,
          inMonth: date.startsWith(month),
          planIds: plans
            .filter((p) => compareDates(p.start, date) <= 0 && compareDates(date, p.end) <= 0)
            .map((p) => p.id),
        };
      }),
    );
  }
  return weeks;
}
