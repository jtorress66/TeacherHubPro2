/** Interface and AI-output languages. Must match the locales in packages/i18n (checked by a test). */
export const languages = ['en', 'es', 'fr', 'pt', 'de', 'it', 'zh'] as const;

export type Language = (typeof languages)[number];

export const defaultLanguage: Language = 'en';

export const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (languages as readonly string[]).includes(value);

/** Each language's code, English name and own name, as teachers type them in a roster. */
const languageWords: Readonly<Record<Language, readonly string[]>> = {
  en: ['en', 'english', 'ingles'],
  es: ['es', 'spanish', 'espanol'],
  fr: ['fr', 'french', 'francais', 'frances'],
  pt: ['pt', 'portuguese', 'portugues'],
  de: ['de', 'german', 'deutsch', 'aleman'],
  it: ['it', 'italian', 'italiano'],
  zh: ['zh', 'chinese', 'mandarin', '中文', '汉语', '普通话', 'chino'],
};

const plain = (text: string): string =>
  text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The language a typed code or name means (without case or accents), or null. */
export function languageFromText(text: string): Language | null {
  const word = plain(text);
  return languages.find((language) => languageWords[language].includes(word)) ?? null;
}
