import { describe, expect, it } from 'vitest';
import { defaultLanguage, languages } from '@thp/domain';
import { defaultLocale, locales } from '@thp/i18n';

describe('language parity', () => {
  it('the domain supports exactly the interface locales', () => {
    expect([...languages]).toEqual([...locales]);
  });

  it('the domain and the interface share the default language', () => {
    expect(defaultLanguage).toBe(defaultLocale);
  });
});
