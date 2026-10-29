import { describe, expect, it } from 'vitest';
import { signedOutRedirect } from './app-guard.ts';

describe('signedOutRedirect', () => {
  it('sends a signed-out visitor of the app to the login page in their language', () => {
    expect(signedOutRedirect('/es/app', false)).toBe('/es/login');
    expect(signedOutRedirect('/en/app/billing', false)).toBe('/en/login');
  });

  it('lets signed-in visitors and public pages through', () => {
    expect(signedOutRedirect('/es/app', true)).toBeNull();
    expect(signedOutRedirect('/es/login', false)).toBeNull();
    expect(signedOutRedirect('/en/apple', false)).toBeNull();
    expect(signedOutRedirect('/en', false)).toBeNull();
  });
});
