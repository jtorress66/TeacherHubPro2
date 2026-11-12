import type { Locale } from '@thp/i18n';

/** A moment as date and time in the viewer's time zone, e.g. "Nov 11, 2026, 8:41:05 PM". */
export const formatInstant = (moment: Date, locale: Locale, timeZone: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone }).format(
    moment,
  );
