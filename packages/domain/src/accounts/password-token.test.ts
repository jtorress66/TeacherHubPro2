import { describe, expect, it } from 'vitest';
import type { PasswordTokenId, SchoolId, UserId } from '../shared/ids.ts';
import {
  issuePasswordToken,
  passwordTokenLifetimeDays,
  usablePasswordToken,
  usePasswordToken,
} from './password-token.ts';

const now = new Date('2026-11-05T12:00:00Z');
const token = issuePasswordToken({
  id: 't1' as PasswordTokenId,
  userId: 'u1' as UserId,
  schoolId: 's1' as SchoolId,
  tokenHash: 'hash',
  purpose: 'welcome',
  now,
});

describe('password tokens', () => {
  it('lasts three days and starts unused', () => {
    expect(passwordTokenLifetimeDays).toBe(3);
    expect(token).toEqual({
      id: 't1',
      userId: 'u1',
      schoolId: 's1',
      tokenHash: 'hash',
      purpose: 'welcome',
      createdAt: now,
      expiresAt: new Date('2026-11-08T12:00:00Z'),
      usedAt: null,
    });
  });

  it('can be used once, before it expires', () => {
    expect(usablePasswordToken(token, new Date('2026-11-08T11:59:59Z'))).toBe(true);
    expect(usablePasswordToken(token, new Date('2026-11-08T12:00:00Z'))).toBe(false);
    const used = usePasswordToken(token, new Date('2026-11-06T09:00:00Z'));
    expect(used.usedAt).toEqual(new Date('2026-11-06T09:00:00Z'));
    expect(usablePasswordToken(used, new Date('2026-11-06T09:00:01Z'))).toBe(false);
  });
});
