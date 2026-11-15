import { describe, expect, it } from 'vitest';
import {
  confirmMessage,
  confirmSignInPath,
  deviceLabel,
  localeOfPath,
  safeNextPath,
  SIGN_IN_CONFIRM_COOKIE,
  signInConfirmCookieOptions,
  signInProblem,
} from './sign-in-confirm.ts';

describe('the pending sign-in cookie', () => {
  it('is httpOnly and lax, secure on https, and lasts as long as its ticket', () => {
    expect(SIGN_IN_CONFIRM_COOKIE).toBe('thp_sign_in_confirm');
    expect(signInConfirmCookieOptions('https://teacherhubpro.com')).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 300,
    });
    expect(signInConfirmCookieOptions('http://localhost:3000').secure).toBe(false);
  });
});

describe('safeNextPath', () => {
  it('keeps a path inside the app', () => {
    expect(safeNextPath('/es/app')).toBe('/es/app');
    expect(safeNextPath('/en/lti/link')).toBe('/en/lti/link');
    expect(safeNextPath('/en/app/assignments/a-1?tab=grading')).toBe(
      '/en/app/assignments/a-1?tab=grading',
    );
  });

  it('refuses anything that could lead elsewhere', () => {
    for (const value of [
      null,
      '',
      'https://evil.example/en/app',
      '//evil.example/en/app',
      '/\\evil.example',
      '/xx/app',
      '/en//evil.example',
      'en/app',
    ]) {
      expect(safeNextPath(value), String(value)).toBeNull();
    }
  });
});

describe('confirmSignInPath', () => {
  it('opens the confirmation page in the page language, remembering where to go next', () => {
    expect(confirmSignInPath('es', '/es/lti/link')).toBe(
      '/es/login/confirm?next=%2Fes%2Flti%2Flink',
    );
  });
});

describe('localeOfPath', () => {
  it('reads the language of an app path, or English', () => {
    expect(localeOfPath('/fr/app')).toBe('fr');
    expect(localeOfPath('/nope')).toBe('en');
  });
});

describe('deviceLabel', () => {
  it('names the browser and system in the page language', () => {
    expect(deviceLabel('en', { browser: 'chrome', os: 'windows' })).toBe('Chrome on Windows');
    expect(deviceLabel('es', { browser: 'safari', os: 'iphone' })).toBe('Safari en iPhone');
    expect(deviceLabel('zh', { browser: 'edge', os: 'windows' })).toBe('Windows 上的 Edge');
    expect(deviceLabel('en', { browser: 'unknown', os: 'unknown' })).toBe(
      'Unknown browser on unknown device',
    );
  });
});

describe('confirmMessage', () => {
  it('says which device and how long ago, in words that read naturally', () => {
    expect(
      confirmMessage('en', { device: { browser: 'chrome', os: 'windows' }, minutesAgo: 5 }),
    ).toBe(
      'This account is already signed in on another device (Chrome on Windows, active 5 minutes ago). If you continue, that device will be signed out.',
    );
    expect(
      confirmMessage('es', { device: { browser: 'firefox', os: 'linux' }, minutesAgo: 1 }),
    ).toBe(
      'Esta cuenta ya tiene la sesión iniciada en otro dispositivo (Firefox en Linux, activo hace 1 minuto). Si continúas, se cerrará la sesión en ese dispositivo.',
    );
  });

  it('says "just now" under a minute', () => {
    expect(
      confirmMessage('en', { device: { browser: 'edge', os: 'windows' }, minutesAgo: 0 }),
    ).toContain('(Edge on Windows, active just now)');
  });

  it('says only "another device" for a session with no recorded device', () => {
    expect(confirmMessage('en', { device: null, minutesAgo: 12 })).toBe(
      'This account is already signed in on another device (active 12 minutes ago). If you continue, that device will be signed out.',
    );
  });
});

describe('signInProblem', () => {
  it('tells a suspended account apart from a sign-in that waited too long', () => {
    expect(signInProblem({ code: 'account_suspended' })).toBe('account_suspended');
    expect(signInProblem({ code: 'sign_in_expired' })).toBe('sign_in_expired');
    expect(signInProblem(undefined)).toBe('sign_in_expired');
  });
});
