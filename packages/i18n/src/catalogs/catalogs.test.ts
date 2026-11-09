import { describe, expect, it } from 'vitest';
import { locales } from '../locales.ts';
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
