import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '../shared/ids.ts';
import {
  endSignInSession,
  isSessionActive,
  needsTouch,
  otherActiveSession,
  recentActivityMinutes,
  startSession,
  touchEveryMinutes,
  touchSession,
  type Session,
} from './session.ts';

const now = new Date('2026-09-01T08:00:00Z');
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
const chrome = { browser: 'chrome', os: 'windows' } as const;

const started = (tokenHash: string, at = now): Session =>
  startSession({
    tokenHash,
    userId: 'teacher-1' as UserId,
    schoolId: 'school-1' as SchoolId,
    device: chrome,
    now: at,
  });

describe('a new session', () => {
  it('starts seen now, on its device, and not ended', () => {
    expect(started('hash-1')).toMatchObject({
      createdAt: now,
      lastSeenAt: now,
      device: chrome,
      endedAt: null,
      endedReason: null,
    });
  });
});

describe('ending a session', () => {
  it('keeps it as a tombstone saying why and when, which is no longer active', () => {
    const ended = endSignInSession(started('hash-1'), 'replaced', minutes(3));

    expect(ended).toMatchObject({ endedAt: minutes(3), endedReason: 'replaced' });
    expect(isSessionActive(ended, minutes(4))).toBe(false);
  });
});

describe('recording activity', () => {
  it('waits five minutes between updates, so a request does not always write', () => {
    const session = started('hash-1');

    expect(touchEveryMinutes).toBe(5);
    expect(needsTouch(session, minutes(4.9))).toBe(false);
    expect(needsTouch(session, minutes(5))).toBe(true);
    expect(touchSession(session, minutes(5)).lastSeenAt).toEqual(minutes(5));
  });
});

describe('otherActiveSession', () => {
  it('finds the most recently seen session active in the last 30 minutes', () => {
    const older = touchSession(started('phone'), minutes(10));
    const newer = touchSession(started('laptop'), minutes(20));

    expect(recentActivityMinutes).toBe(30);
    expect(otherActiveSession([older, newer], null, minutes(25))).toEqual(newer);
  });

  it('ignores sessions idle for 30 minutes or more', () => {
    expect(otherActiveSession([started('phone')], null, minutes(30))).toBeNull();
    expect(otherActiveSession([started('phone')], null, minutes(29))).not.toBeNull();
  });

  it("ignores this browser's own session", () => {
    expect(otherActiveSession([started('mine')], 'mine', minutes(1))).toBeNull();
  });

  it('ignores ended and expired sessions', () => {
    const ended = endSignInSession(started('phone'), 'replaced', minutes(1));
    const expired = started('laptop', new Date('2026-07-01T08:00:00Z'));
    const lateTouch = touchSession(expired, minutes(-1));

    expect(otherActiveSession([ended, lateTouch], null, minutes(2))).toBeNull();
  });
});
