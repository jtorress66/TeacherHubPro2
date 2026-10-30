import { addDays, planSpan, type LessonPlan, type LocalDate } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/** The Monday after `today` (a week from today when today is a Monday). */
export function nextMonday(today: LocalDate): LocalDate {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, (8 - weekday) % 7 || 7);
}

/** The Monday of the week `date` is in. */
export function mondayOf(date: LocalDate): LocalDate {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export const formatDate = (date: LocalDate, locale: Locale): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));

/** "7 Sept 2026 – 11 Sept 2026", or one date for a one-day lesson. */
export function planDates(plan: LessonPlan, locale: Locale): string {
  const { start, end } = planSpan(plan.body);
  if (start === end) return formatDate(start, locale);
  return createTranslator(locale)('planner.dates', {
    start: formatDate(start, locale),
    end: formatDate(end, locale),
  });
}

/** The plan's title, or its unit, or its kind. */
export function planName(plan: LessonPlan, locale: Locale): string {
  if (plan.title) return plan.title;
  if (plan.body.kind === 'weekly' && plan.body.unit) return plan.body.unit;
  return createTranslator(locale)(`planner.kind_${plan.body.kind}`);
}

/** Where a duplicate starts by default: the week after the plan's own. */
export const nextStartOf = (plan: LessonPlan): LocalDate => addDays(planSpan(plan.body).start, 7);
