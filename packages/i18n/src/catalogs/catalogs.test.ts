import { describe, expect, it } from 'vitest';
import { locales, type Locale } from '../locales.ts';
import { catalogs } from './index.ts';

/** Every language but English, which defines the keys. */
const completeLocales = locales.filter((locale) => locale !== 'en');

function leafEntries(tree: unknown, prefix = ''): [string, unknown][] {
  if (typeof tree !== 'object' || tree === null) return [[prefix, tree]];
  return Object.entries(tree).flatMap(([key, value]) =>
    leafEntries(value, prefix ? `${prefix}.${key}` : key),
  );
}

const keysOf = (tree: unknown): string[] =>
  leafEntries(tree)
    .map(([key]) => key)
    .sort();

describe('catalogs', () => {
  it('registers a catalog for every locale', () => {
    expect(Object.keys(catalogs).sort()).toEqual([...locales].sort());
  });

  it('en and es catalogs have identical keys', () => {
    expect(keysOf(catalogs.es)).toEqual(keysOf(catalogs.en));
  });

  it.each(completeLocales)('the %s catalog has every English key', (locale) => {
    expect(keysOf(catalogs[locale])).toEqual(keysOf(catalogs.en));
  });

  it('every translation keeps the English placeholders', () => {
    const english = new Map(leafEntries(catalogs.en));
    const placeholders = (text: unknown) => (String(text).match(/\{\w+\}/gu) ?? []).sort();
    for (const locale of locales) {
      for (const [key, value] of leafEntries(catalogs[locale])) {
        expect(placeholders(value), `${locale}:${key}`).toEqual(placeholders(english.get(key)));
      }
    }
  });

  it('partial catalogs contain no keys unknown to English', () => {
    const english = new Set(keysOf(catalogs.en));
    for (const locale of locales) {
      const unknown = keysOf(catalogs[locale]).filter((key) => !english.has(key));
      expect(unknown, locale).toEqual([]);
    }
  });

  it('has no empty translations', () => {
    for (const locale of locales) {
      for (const [key, value] of leafEntries(catalogs[locale])) {
        expect(typeof value, `${locale}:${key}`).toBe('string');
        expect(String(value).trim(), `${locale}:${key}`).not.toBe('');
      }
    }
  });
});

/** How each language would say that a language is only partly translated. */
const partlyTranslated: Readonly<Record<Locale, RegExp>> = {
  en: /(partly|partially) translated|translated in part/iu,
  es: /traducid[oa]s? (en parte|parcialmente)|parcialmente traducid/iu,
  fr: /partiellement tradui|tradui\w* en partie/iu,
  pt: /parcialmente traduzid|traduzid[oa]s? (em parte|parcialmente)/iu,
  de: /teilweise übersetzt/iu,
  it: /tradott[oaie] in parte|parzialmente tradott/iu,
  zh: /部分翻译|部分翻譯/u,
};

describe('what the site says about its languages', () => {
  it.each(locales)('never says a language is only partly translated (%s)', (locale) => {
    const claims = leafEntries(catalogs[locale]).filter(([, value]) =>
      partlyTranslated[locale].test(String(value)),
    );
    expect(claims).toEqual([]);
  });

  it.each(locales)(
    'sends teachers to Connected tools to connect Google Classroom (%s)',
    (locale) => {
      const catalog = catalogs[locale];
      expect(catalog.marketing.helpPage.faq4A).toContain(catalog.nav.connectedTools);
    },
  );
});
