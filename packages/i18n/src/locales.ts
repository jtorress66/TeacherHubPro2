export const locales = ['en', 'es', 'fr', 'pt', 'de', 'it', 'zh'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Languages whose catalogs contain every key; the others fall back to English. */
export const fullyTranslatedLocales = ['en', 'es'] as const satisfies readonly Locale[];

export interface LocaleInfo {
  readonly name: string;
  readonly nativeName: string;
  readonly flag: string;
}

export const localeInfo: Readonly<Record<Locale, LocaleInfo>> = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value);
