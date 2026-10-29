import type { SchoolId, UserId } from '../shared/ids.ts';

export const sessionLifetimeDays = 30;

const lifetimeMs = sessionLifetimeDays * 24 * 60 * 60 * 1000;

/**
 * A signed-in browser. The secret token lives only in the user's cookie; the server keeps its
 * hash, so a leaked database cannot be used to sign in.
 */
export interface Session {
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export function startSession(input: {
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly now: Date;
}): Session {
  return {
    tokenHash: input.tokenHash,
    userId: input.userId,
    schoolId: input.schoolId,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + lifetimeMs),
  };
}

export const isSessionActive = (session: Session, now: Date): boolean =>
  now.getTime() < session.expiresAt.getTime();
