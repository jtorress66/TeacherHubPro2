import { describe, expect, it } from 'vitest';
import type { UserId } from '../shared/ids.ts';
import {
  emailConfirmationLifetimeDays,
  issueEmailConfirmation,
  usableEmailConfirmation,
  useEmailConfirmation,
} from './email-confirmation.ts';

const now = new Date('2026-11-11T12:00:00Z');
const confirmation = issueEmailConfirmation({ userId: 'u1' as UserId, tokenHash: 'hash', now });

describe('email confirmations', () => {
  it('lasts three days and starts unused', () => {
    expect(emailConfirmationLifetimeDays).toBe(3);
    expect(confirmation).toEqual({
      userId: 'u1',
      tokenHash: 'hash',
      createdAt: now,
      expiresAt: new Date('2026-11-14T12:00:00Z'),
      usedAt: null,
    });
  });

  it('works until it expires', () => {
    expect(usableEmailConfirmation(confirmation, new Date('2026-11-14T11:59:59Z'))).toBe(true);
    expect(usableEmailConfirmation(confirmation, new Date('2026-11-14T12:00:00Z'))).toBe(false);
  });

  it('works only once', () => {
    const used = useEmailConfirmation(confirmation, now);
    expect(used.usedAt).toEqual(now);
    expect(usableEmailConfirmation(used, now)).toBe(false);
  });
});
