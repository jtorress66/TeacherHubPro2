import type { Session, UserId } from '@thp/domain';

/** Stores sessions by the hash of their token; the raw token never reaches storage. */
export interface SessionRepository {
  save(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  delete(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: UserId): Promise<void>;
}
