import { defaultLocale, isLocale, type Locale } from './locales.ts';

export interface LocaleHints {
  /** Value of a `?lang=` link parameter. */
  readonly queryLang?: string | null | undefined;
  /** The language the user chose earlier (cookie or profile). */
  readonly saved?: string | null | undefined;
}

/** Picks the interface language: `?lang=` link, then saved choice, then English. */
export function resolveLocale({ queryLang, saved }: LocaleHints): Locale {
  if (isLocale(queryLang)) return queryLang;
  if (isLocale(saved)) return saved;
  return defaultLocale;
}
