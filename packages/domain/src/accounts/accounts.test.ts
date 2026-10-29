import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { checkPassword } from './password-policy.ts';
import { isSessionActive, sessionLifetimeDays, startSession } from './session.ts';

describe('checkPassword', () => {
  it('accepts a password of 10 to 200 characters', () => {
    expect(valueOf(checkPassword('correct horse', 'ana@mail.com'))).toBe('correct horse');
    expect(valueOf(checkPassword('x'.repeat(200), 'ana@mail.com'))).toHaveLength(200);
  });

  it('rejects a password shorter than 10 characters, ignoring surrounding spaces', () => {
    expect(errorOf(checkPassword('short', 'ana@mail.com'))).toEqual({
      field: 'password',
      code: 'too_short',
    });
    expect(errorOf(checkPassword('   abc    ', 'ana@mail.com'))).toEqual({
      field: 'password',
      code: 'too_short',
    });
  });

  it('rejects a password longer than 200 characters', () => {
    expect(errorOf(checkPassword('x'.repeat(201), 'ana@mail.com'))).toEqual({
      field: 'password',
      code: 'too_long',
    });
  });

  it('rejects the email address as the password', () => {
    expect(errorOf(checkPassword(' Teacher@School.EDU ', 'teacher@school.edu'))).toEqual({
      field: 'password',
      code: 'not_allowed',
    });
  });
});

describe('sessions', () => {
  const now = new Date('2026-09-01T08:00:00Z');
  const session = startSession({
    tokenHash: 'hash-1',
    userId: 'teacher-1' as UserId,
    schoolId: 'school-1' as SchoolId,
    now,
  });

  it('last 30 days, as in the original app', () => {
    expect(sessionLifetimeDays).toBe(30);
    expect(session).toEqual({
      tokenHash: 'hash-1',
      userId: 'teacher-1',
      schoolId: 'school-1',
      createdAt: now,
      expiresAt: new Date('2026-10-01T08:00:00Z'),
    });
  });

  it('are active until they expire', () => {
    expect(isSessionActive(session, new Date('2026-09-30T23:59:59Z'))).toBe(true);
    expect(isSessionActive(session, new Date('2026-10-01T08:00:00Z'))).toBe(false);
  });
});
