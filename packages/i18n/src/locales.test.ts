import { describe, expect, it } from 'vitest';
import { defaultLocale, fullyTranslatedLocales, isLocale, localeInfo, locales } from './locales.ts';

describe('locales', () => {
  it('supports the seven languages of the original app', () => {
    expect([...locales]).toEqual(['en', 'es', 'fr', 'pt', 'de', 'it', 'zh']);
  });

  it('uses English as the default', () => {
    expect(defaultLocale).toBe('en');
  });

  it('marks English and Spanish as fully translated', () => {
    expect([...fullyTranslatedLocales]).toEqual(['en', 'es']);
  });

  it('recognises supported codes only', () => {
    expect(isLocale('zh')).toBe(true);
    expect(isLocale('ru')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('has a native name for every language', () => {
    expect(localeInfo.es.nativeName).toBe('Español');
    for (const locale of locales) {
      expect(localeInfo[locale].nativeName.length).toBeGreaterThan(0);
    }
  });
});
