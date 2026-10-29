import { describe, expect, it } from 'vitest';
import type { Catalogs } from './catalogs/index.ts';
import { catalogs } from './catalogs/index.ts';
import { createTranslator } from './translator.ts';

describe('createTranslator', () => {
  it('translates a key into the requested language', () => {
    expect(createTranslator('en')('home.title')).toBe(catalogs.en.home.title);
    expect(createTranslator('es')('home.title')).toBe(catalogs.es.home.title);
    expect(createTranslator('es')('home.title')).not.toBe(catalogs.en.home.title);
  });

  it('falls back to English for a key missing in French', () => {
    const t = createTranslator('fr', { ...catalogs, fr: {} });

    expect(t('home.title')).toBe(catalogs.en.home.title);
  });

  it('uses the French text once it exists', () => {
    const withFrench: Catalogs = { ...catalogs, fr: { home: { title: 'Votre espace' } } };
    const t = createTranslator('fr', withFrench);

    expect(t('home.title')).toBe('Votre espace');
    expect(t('home.tagline')).toBe(catalogs.en.home.tagline);
  });

  it('interpolates {name} placeholders', () => {
    const withGreeting: Catalogs = {
      ...catalogs,
      es: { ...catalogs.es, home: { ...catalogs.es.home, title: 'Hola, {name} ({count})' } },
    };
    const t = createTranslator('es', withGreeting);

    expect(t('home.title', { name: 'Ana', count: 3 })).toBe('Hola, Ana (3)');
  });

  it('leaves a placeholder visible when its value is not given', () => {
    const withGreeting: Catalogs = {
      ...catalogs,
      en: { ...catalogs.en, home: { ...catalogs.en.home, title: 'Hi, {name}' } },
    };

    expect(createTranslator('en', withGreeting)('home.title')).toBe('Hi, {name}');
  });
});
