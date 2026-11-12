import { describe, expect, it } from 'vitest';
import {
  emailDomain,
  isThrowawayEmail,
  isWithinDomain,
  matchesBlockedDomain,
  parseBlockedDomain,
} from './email-domains.ts';

describe('email domains', () => {
  it('reads the domain of an email, in lower case', () => {
    expect(emailDomain('Ana@School.EDU')).toBe('school.edu');
    expect(emailDomain('no-at-sign')).toBe('');
  });

  it('counts a subdomain as part of its domain, but not a look-alike', () => {
    expect(isWithinDomain('students.school.edu', 'school.edu')).toBe(true);
    expect(isWithinDomain('school.edu', 'school.edu')).toBe(true);
    expect(isWithinDomain('myschool.edu', 'school.edu')).toBe(false);
    expect(isWithinDomain('school.edu.evil.com', 'school.edu')).toBe(false);
  });

  it('matches an email against a list of blocked domains, subdomains included', () => {
    const blocked = ['students.example.org', 'kids.test'];
    expect(matchesBlockedDomain('pupil@students.example.org', blocked)).toBe(true);
    expect(matchesBlockedDomain('pupil@g7.students.example.org', blocked)).toBe(true);
    expect(matchesBlockedDomain('teacher@example.org', blocked)).toBe(false);
    expect(matchesBlockedDomain('teacher@example.org', [])).toBe(false);
  });
});

describe('throwaway email addresses', () => {
  it.each([
    'someone@mailinator.com',
    'someone@guerrillamail.com',
    'someone@guerrillamail.net',
    'someone@10minutemail.com',
    'someone@temp-mail.org',
    'someone@yopmail.com',
    'someone@trashmail.com',
    'someone@sharklasers.com',
    'someone@getnada.com',
    'someone@dispostable.com',
    'someone@maildrop.cc',
    'someone@throwawaymail.com',
    'someone@fakeinbox.com',
    'SOMEONE@MAILINATOR.COM',
  ])('refuses %s', (email) => {
    expect(isThrowawayEmail(email)).toBe(true);
  });

  it('refuses a subdomain of a throwaway service', () => {
    expect(isThrowawayEmail('someone@inbox.mailinator.com')).toBe(true);
  });

  it.each([
    'teacher@gmail.com',
    'teacher@school.edu',
    'teacher@outlook.com',
    'teacher@notmailinator.com',
    'teacher@mailinator.com.school.edu',
  ])('accepts %s', (email) => {
    expect(isThrowawayEmail(email)).toBe(false);
  });
});

describe('blocked domain input', () => {
  it('trims, lowercases and drops a leading @', () => {
    expect(parseBlockedDomain('  @Students.Example.ORG ')).toEqual({
      ok: true,
      value: 'students.example.org',
    });
    expect(parseBlockedDomain('kids.test')).toEqual({ ok: true, value: 'kids.test' });
  });

  it.each(['', '   ', '@', 'localhost', 'ana@school.edu', 'bad domain.com', '-x.com', 'a..b.com'])(
    'refuses %j',
    (input) => {
      const parsed = parseBlockedDomain(input);
      expect(parsed.ok).toBe(false);
    },
  );

  it('says a blank domain is required', () => {
    expect(parseBlockedDomain(' ')).toEqual({
      ok: false,
      error: { field: 'domain', code: 'required' },
    });
    expect(parseBlockedDomain('nope')).toEqual({
      ok: false,
      error: { field: 'domain', code: 'invalid_format' },
    });
  });
});
