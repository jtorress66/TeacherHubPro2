import { describe, expect, it } from 'vitest';
import {
  inviteLink,
  REFERRAL_COOKIE,
  referralCookieOptions,
  referralFromSearch,
} from './referral.ts';

describe('the invite code in a link', () => {
  it('is read from ?ref= when it is a real code', () => {
    expect(referralFromSearch(new URLSearchParams('ref=K7M2QX9P'))).toBe('K7M2QX9P');
  });

  it('is ignored when missing or not a code', () => {
    expect(referralFromSearch(new URLSearchParams(''))).toBeNull();
    expect(referralFromSearch(new URLSearchParams('ref=<script>'))).toBeNull();
    expect(referralFromSearch(new URLSearchParams('ref=k7m2qx9p'))).toBeNull();
  });

  it('is kept for 30 days in a cookie scripts cannot read', () => {
    expect(REFERRAL_COOKIE).toBe('thp_ref');
    expect(referralCookieOptions).toEqual({
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
    });
  });

  it('builds the sign-up link a teacher shares, in their language', () => {
    expect(inviteLink('https://teacherhubpro.com', 'es', 'K7M2QX9P')).toBe(
      'https://teacherhubpro.com/es/signup?ref=K7M2QX9P',
    );
  });
});
