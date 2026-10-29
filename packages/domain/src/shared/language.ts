/** Interface and AI-output languages. Must match the locales in packages/i18n (checked by a test). */
export const languages = ['en', 'es', 'fr', 'pt', 'de', 'it', 'zh'] as const;

export type Language = (typeof languages)[number];

export const defaultLanguage: Language = 'en';

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (languages as readonly string[]).includes(value);
