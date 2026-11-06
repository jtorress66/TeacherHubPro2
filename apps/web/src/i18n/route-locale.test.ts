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

  it('sends links shared from the old app to their new pages, in the saved language', () => {
    const route = (pathname: string) => routeLocale({ pathname, search: '', saved: 'es' });

    expect(route('/portal/portal_abc')).toMatchObject({ to: '/es/p/portal_abc' });
    expect(route('/homeschool-portal/hsp_abc')).toMatchObject({ to: '/es/p/hsp_abc' });
    expect(route('/student-learning/slt_abc')).toMatchObject({ to: '/es/s/slt_abc' });
    expect(route('/assignment/abc123')).toMatchObject({ to: '/es/old-link' });
    expect(route('/play-game/game_1')).toMatchObject({ to: '/es/old-link' });
    expect(route('/portal')).toMatchObject({ to: '/es/portal' });
  });
});
