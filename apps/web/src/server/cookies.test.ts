import { describe, expect, it } from 'vitest';
import {
  decodeOAuthState,
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
