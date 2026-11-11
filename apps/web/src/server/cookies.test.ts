import { describe, expect, it } from 'vitest';
import {
  CANVA_OAUTH_COOKIE,
  MICROSOFT_OAUTH_COOKIE,
  decodePkceOAuth,
  decodeOAuthState,
  encodePkceOAuth,
  encodeOAuthState,
  oauthStateCookieOptions,
  sessionCookieOptions,
  SESSION_COOKIE,
} from './cookies.ts';

describe('session cookie', () => {
  it('is httpOnly and lax, secure on https, and expires with the session', () => {
    const expires = new Date('2026-10-01T08:00:00Z');

    expect(SESSION_COOKIE).toBe('thp_session');
    expect(sessionCookieOptions('https://teacherhubpro.com', expires)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      expires,
    });
    expect(sessionCookieOptions('http://localhost:3000', expires).secure).toBe(false);
  });
});

describe('Google sign-in state cookie', () => {
  it('carries the random state and the language, and lasts ten minutes', () => {
    expect(decodeOAuthState(encodeOAuthState('abc123', 'es'))).toEqual({
      state: 'abc123',
      locale: 'es',
    });
    expect(oauthStateCookieOptions('https://x.com')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 600,
    });
  });

  it('rejects a damaged value', () => {
    expect(decodeOAuthState(undefined)).toBeNull();
    expect(decodeOAuthState('no-separator')).toBeNull();
    expect(decodeOAuthState('.es')).toBeNull();
    expect(decodeOAuthState('abc.ru')).toEqual({ state: 'abc', locale: 'en' });
  });
});

describe('Canva and Microsoft connect cookies', () => {
  it('carry the state, the PKCE verifier and the language, each under its own name', () => {
    expect(CANVA_OAUTH_COOKIE).toBe('thp_canva_oauth');
    expect(MICROSOFT_OAUTH_COOKIE).toBe('thp_microsoft_oauth');
    const value = encodePkceOAuth({ state: 'st_1-x', verifier: 'v-erifier_9', locale: 'es' });
    expect(decodePkceOAuth(value)).toEqual({
      state: 'st_1-x',
      verifier: 'v-erifier_9',
      locale: 'es',
    });
  });

  it('rejects a damaged value and falls back to the default language', () => {
    expect(decodePkceOAuth(undefined)).toBeNull();
    expect(decodePkceOAuth('only-state')).toBeNull();
    expect(decodePkceOAuth('.v.es')).toBeNull();
    expect(decodePkceOAuth('s..es')).toBeNull();
    expect(decodePkceOAuth('s.v.xx')).toEqual({ state: 's', verifier: 'v', locale: 'en' });
  });
});
