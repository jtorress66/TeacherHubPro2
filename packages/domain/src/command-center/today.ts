import type { Class } from '../classes/class.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { defaultSchoolDays, weekdays, type Weekday } from '../shared/weekday.ts';

/** The day of the week a date falls on. */
export const weekdayOf = (date: LocalDate): Weekday =>
  weekdays[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7] ?? 'Mon';

/** Classes without a period or start time come after those with one. */
const latest = 99;

/**
 * The classes that meet on this day, by period and then start time. A class without a schedule
 * meets Monday to Friday.
 */
export function classesToday(classes: readonly Class[], day: Weekday): Class[] {
  return classes
    .filter((cls) => (cls.schedule?.days ?? defaultSchoolDays).includes(day))
    .sort(
      (a, b) =>
        (a.schedule?.period ?? latest) - (b.schedule?.period ?? latest) ||
        (a.schedule?.startTime ?? '99:99').localeCompare(b.schedule?.startTime ?? '99:99'),
    );
}
