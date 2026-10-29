import { describe, expect, it } from 'vitest';
import { routeLocale } from './route-locale.ts';

describe('routeLocale', () => {
  it('sends / to English when nothing is known', () => {
    expect(routeLocale({ pathname: '/', search: '', saved: undefined })).toEqual({
      kind: 'redirect',
      to: '/en',
      save: 'en',
    });
  });

  it('sends / to the saved language', () => {
    expect(routeLocale({ pathname: '/', search: '', saved: 'es' })).toEqual({
      kind: 'redirect',
      to: '/es',
      save: 'es',
    });
  });

  it('a ?lang= link overrides the saved language and is removed from the address', () => {
    expect(routeLocale({ pathname: '/', search: '?lang=fr&ref=x', saved: 'es' })).toEqual({
      kind: 'redirect',
      to: '/fr?ref=x',
      save: 'fr',
    });
  });

  it('keeps the rest of the path when adding a language', () => {
    expect(routeLocale({ pathname: '/pricing', search: '', saved: 'de' })).toEqual({
      kind: 'redirect',
      to: '/de/pricing',
      save: 'de',
    });
  });

  it('switches an address that already has a language when ?lang= asks for another', () => {
    expect(routeLocale({ pathname: '/es/pricing', search: '?lang=en', saved: 'es' })).toEqual({
      kind: 'redirect',
      to: '/en/pricing',
      save: 'en',
    });
  });

  it('serves an address with a language and remembers that language', () => {
    expect(routeLocale({ pathname: '/zh', search: '', saved: 'en' })).toEqual({
      kind: 'next',
      save: 'zh',
    });
  });

  it('ignores an unsupported ?lang= value', () => {
    expect(routeLocale({ pathname: '/es', search: '?lang=ru', saved: undefined })).toEqual({
      kind: 'next',
      save: 'es',
    });
  });
});
