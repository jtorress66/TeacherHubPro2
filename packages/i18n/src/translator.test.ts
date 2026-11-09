import { describe, expect, it } from 'vitest';
import { catalogs } from './catalogs/index.ts';
import { createTranslator, type TranslatorCatalogs } from './translator.ts';

describe('createTranslator', () => {
  it('translates a key into the requested language', () => {
    expect(createTranslator('en')('home.title')).toBe(catalogs.en.home.title);
    expect(createTranslator('es')('home.title')).toBe(catalogs.es.home.title);
    expect(createTranslator('es')('home.title')).not.toBe(catalogs.en.home.title);
  });

  it('falls back to English for a key missing in Chinese', () => {
    const t = createTranslator('zh', { ...catalogs, zh: {} });

    expect(t('home.title')).toBe(catalogs.en.home.title);
  });

  it('uses the Chinese text once it exists', () => {
    const withChinese: TranslatorCatalogs = { ...catalogs, zh: { home: { title: '您的空间' } } };
    const t = createTranslator('zh', withChinese);

    expect(t('home.title')).toBe('您的空间');
    expect(t('home.tagline')).toBe(catalogs.en.home.tagline);
  });

  it('interpolates {name} placeholders', () => {
    const withGreeting: TranslatorCatalogs = {
      ...catalogs,
      es: { ...catalogs.es, home: { ...catalogs.es.home, title: 'Hola, {name} ({count})' } },
    };
    const t = createTranslator('es', withGreeting);

    expect(t('home.title', { name: 'Ana', count: 3 })).toBe('Hola, Ana (3)');
  });

  it('leaves a placeholder visible when its value is not given', () => {
    const withGreeting: TranslatorCatalogs = {
      ...catalogs,
      en: { ...catalogs.en, home: { ...catalogs.en.home, title: 'Hi, {name}' } },
    };

    expect(createTranslator('en', withGreeting)('home.title')).toBe('Hi, {name}');
  });
});
