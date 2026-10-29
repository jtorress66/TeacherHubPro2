import type { Schedule } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/** "Period 2 · 08:50–09:40 · Mon, Wed, Fri", leaving out the parts that are not set. */
export function scheduleSummary(schedule: Schedule | null, locale: Locale): string {
  if (schedule === null) return '';
  const t = createTranslator(locale);
  const parts = [
    schedule.period === null ? null : t('classes.periodLabel', { period: schedule.period }),
    schedule.startTime === null || schedule.endTime === null
      ? null
      : `${schedule.startTime}–${schedule.endTime}`,
    schedule.days.map((day) => t(`weekdays.${day}`)).join(', '),
  ];
  return parts.filter((part) => part !== null).join(' · ');
}
