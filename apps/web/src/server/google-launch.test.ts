import { describe, expect, it } from 'vitest';
import { googleLaunchPath } from './google-launch.ts';

describe('googleLaunchPath', () => {
  it('opens the dashboard of a signed-in teacher, in their saved language', () => {
    expect(googleLaunchPath({ hasSession: true, savedLanguage: 'es' })).toBe('/es/app');
  });

  it('starts Google sign-in straight away for a signed-out visitor, in their saved language', () => {
    expect(googleLaunchPath({ hasSession: false, savedLanguage: 'fr' })).toBe(
      '/api/auth/google/start?locale=fr',
    );
  });

  it('uses English when no language is saved or the saved one is not supported', () => {
    expect(googleLaunchPath({ hasSession: true, savedLanguage: undefined })).toBe('/en/app');
    expect(googleLaunchPath({ hasSession: false, savedLanguage: 'xx' })).toBe(
      '/api/auth/google/start?locale=en',
    );
  });
});
