import type { CalendarFeedLabels } from '@thp/application';
import type { Language } from '@thp/domain';
import { createTranslator, isLocale } from '@thp/i18n';

/** Link tokens are URL-safe base64; the address may end in .ics for calendar apps. */
const tokenPattern = /^([A-Za-z0-9_-]{32,128})(?:\.ics)?$/u;

/** The token in a calendar address, or null when it cannot be one. */
export function calendarToken(param: string): string | null {
  return tokenPattern.exec(param)?.[1] ?? null;
}

/** The calendar's name and entries in the teacher's saved language. */
export function calendarLabels(language: Language): CalendarFeedLabels {
  const t = createTranslator(isLocale(language) ? language : 'en');
  return {
    calendarName: t('calendarFeed.calendarName'),
    untitledPlan: t('calendarFeed.untitledPlan'),
    due: (title, className) => t('calendarFeed.due', { title, className }),
  };
}

export const calendarHeaders = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="teacherhubpro.ics"',
  'Cache-Control': 'private, max-age=300',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
} as const;
