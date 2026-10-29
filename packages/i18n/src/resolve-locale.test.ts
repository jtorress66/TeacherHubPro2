import { describe, expect, it } from 'vitest';
import { resolveLocale } from './resolve-locale.ts';

describe('resolveLocale', () => {
  it('defaults to English when nothing is known', () => {
    expect(resolveLocale({})).toBe('en');
  });

  it('the saved choice overrides the default', () => {
    expect(resolveLocale({ saved: 'es' })).toBe('es');
  });

  it('a ?lang= link overrides the saved choice', () => {
    expect(resolveLocale({ queryLang: 'fr', saved: 'es' })).toBe('fr');
  });

  it('ignores an unsupported language such as ru', () => {
    expect(resolveLocale({ queryLang: 'ru', saved: 'de' })).toBe('de');
    expect(resolveLocale({ queryLang: 'ru', saved: 'xx' })).toBe('en');
  });

  it('ignores empty and missing values', () => {
    expect(resolveLocale({ queryLang: '', saved: null })).toBe('en');
  });
});
