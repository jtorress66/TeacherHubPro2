'use client';

import { useEffect } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { TIME_ZONE_COOKIE } from '../server/time-zone.ts';

/** Remembers the browser's time zone so the server knows which day "today" is for the teacher. */
export function TimeZoneCookie() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}

export function PrintButton({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <button
      type="button"
      className="button secondary no-print"
      onClick={() => {
        window.print();
      }}
    >
      {t('attendance.print')}
    </button>
  );
}
