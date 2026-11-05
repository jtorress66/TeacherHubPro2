import type { PlanSpan } from '../lesson-plans/lesson-plan.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';

const window = 7;

/** Plans that cover any of the next seven days (today included), soonest first. */
export function upcomingLessons<T extends { readonly span: PlanSpan }>(
  plans: readonly T[],
  today: LocalDate,
): T[] {
  const last = addDays(today, window);
  return plans
    .filter((plan) => plan.span.end >= today && plan.span.start <= last)
    .sort((a, b) => a.span.start.localeCompare(b.span.start));
}
