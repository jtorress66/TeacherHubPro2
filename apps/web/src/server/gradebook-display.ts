import type { LetterGrade } from '@thp/domain';
import type { Locale } from '@thp/i18n';

const none = '—';

/** "86.3%" (or "86,3 %" in Spanish); a dash when there is nothing to show. */
export function formatPercent(value: number | null, locale: Locale): string {
  if (value === null) return none;
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
    value / 100,
  );
}

/** A GPA on the 4.0 scale with two decimals. */
export function formatGpa(gpa: number | null, locale: Locale): string {
  if (gpa === null) return none;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(gpa);
}

export function formatPoints(points: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(points);
}

export type LetterBand = 'a' | 'b' | 'c' | 'd' | 'f' | 'none';

/** The CSS band for a letter; the letter itself is always shown too, never colour alone. */
export const letterBand = (letter: LetterGrade | null): LetterBand =>
  letter === null ? 'none' : (letter.toLowerCase() as LetterBand);
