import type { SchoolId, UserId } from '../shared/ids.ts';
import type { DeviceKeys } from './device.ts';

export const sessionLifetimeDays = 30;

/** A session seen this recently counts as in use: signing in elsewhere asks first. */
export const recentActivityMinutes = 30;

/** Activity is recorded at most this often, so a request does not always write. */
export const touchEveryMinutes = 5;

const minuteMs = 60 * 1000;
const lifetimeMs = sessionLifetimeDays * 24 * 60 * minuteMs;

/** Why a session ended before it expired: the account signed in on another device. */
export type SessionEndedReason = 'replaced';

/**
 * A signed-in browser. The secret token lives only in the user's cookie; the server keeps its
 * hash, so a leaked database cannot be used to sign in. An ended session is kept (until it
 * expires) so its browser can be told why it was signed out.
 */
export interface Session {
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  /** Null for sessions started before devices were recorded. */
  readonly device: DeviceKeys | null;
  readonly endedAt: Date | null;
  readonly endedReason: SessionEndedReason | null;
}

export function startSession(input: {
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly device: DeviceKeys | null;
  readonly now: Date;
}): Session {
  return {
    tokenHash: input.tokenHash,
    userId: input.userId,
    schoolId: input.schoolId,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + lifetimeMs),
    lastSeenAt: input.now,
    device: input.device,
    endedAt: null,
    endedReason: null,
  };
}

export const isSessionExpired = (session: Session, now: Date): boolean =>
  now.getTime() >= session.expiresAt.getTime();

export const isSessionEnded = (session: Session): boolean => session.endedAt !== null;

/** Neither expired nor ended: its cookie still signs the browser in. */
export const isSessionActive = (session: Session, now: Date): boolean =>
  !isSessionExpired(session, now) && !isSessionEnded(session);

export const endSignInSession = (
  session: Session,
  reason: SessionEndedReason,
  at: Date,
): Session => ({ ...session, endedAt: at, endedReason: reason });

export const needsTouch = (session: Session, now: Date): boolean =>
  now.getTime() - session.lastSeenAt.getTime() >= touchEveryMinutes * minuteMs;

export const touchSession = (session: Session, now: Date): Session => ({
  ...session,
  lastSeenAt: now,
});

const recentlyActive = (session: Session, now: Date): boolean =>
  isSessionActive(session, now) &&
  now.getTime() - session.lastSeenAt.getTime() < recentActivityMinutes * minuteMs;

/**
 * The most recently seen session, other than this browser's own (`ownTokenHash`), that was in use
 * in the last 30 minutes; null when there is none.
 */
export function otherActiveSession(
  sessions: readonly Session[],
  ownTokenHash: string | null,
  now: Date,
): Session | null {
  const others = sessions.filter(
    (session) => session.tokenHash !== ownTokenHash && recentlyActive(session, now),
  );
  return others.reduce<Session | null>(
    (latest, session) =>
      latest === null || session.lastSeenAt.getTime() > latest.lastSeenAt.getTime()
        ? session
        : latest,
    null,
  );
}
