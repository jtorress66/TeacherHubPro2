import type { Session, SessionEndedReason, UserId } from '@thp/domain';

/** Stores sessions by the hash of their token; the raw token never reaches storage. */
export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /** A user's sessions that still sign a browser in: neither ended nor expired at `now`. */
  listActiveForUser(userId: UserId, now: Date): Promise<readonly Session[]>;
  /**
   * Ends every active session of a user except `keepTokenHash`, keeping each as a tombstone with
   * the reason, and removes the user's expired sessions.
   */
  endAllForUserExcept(
    userId: UserId,
    keepTokenHash: string,
    reason: SessionEndedReason,
    at: Date,
  ): Promise<void>;
  /** Records activity on a session that has not ended; does nothing otherwise. */
  touch(tokenHash: string, at: Date): Promise<void>;
  delete(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: UserId): Promise<void>;
}
