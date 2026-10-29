import type { Locale } from '@thp/i18n';

export type RateBand = 'good' | 'warning' | 'low' | 'none';

/** The lowest rate of each band, best first (as the original reports coloured them). */
const bands: readonly { readonly min: number; readonly band: RateBand }[] = [
  { min: 90, band: 'good' },
  { min: 80, band: 'warning' },
  { min: 0, band: 'low' },
];

export function rateBand(rate: number | null): RateBand {
  if (rate === null) return 'none';
  return bands.find(({ min }) => rate >= min)?.band ?? 'low';
}

/** "83.3%" (or "83,3 %" in Spanish); a dash when there were no days. */
export function formatRate(rate: number | null, locale: Locale): string {
  if (rate === null) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
    rate / 100,
  );
}
