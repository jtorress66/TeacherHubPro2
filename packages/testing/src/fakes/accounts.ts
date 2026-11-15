import {
  endSignInSession,
  isSessionActive,
  isSessionExpired,
  touchSession,
  type Session,
  type SessionEndedReason,
  type UserId,
} from '@thp/domain';
import type {
  PasswordCredential,
  PasswordCredentialRepository,
  SessionRepository,
} from '@thp/ports';

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, Session>();

  save(session: Session): Promise<void> {
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string): Promise<Session | null> {
    return Promise.resolve(this.sessions.get(tokenHash) ?? null);
  }

  listActiveForUser(userId: UserId, now: Date): Promise<readonly Session[]> {
    return Promise.resolve(
      this.all().filter((session) => session.userId === userId && isSessionActive(session, now)),
    );
  }

  endAllForUserExcept(
    userId: UserId,
    keepTokenHash: string,
    reason: SessionEndedReason,
    at: Date,
  ): Promise<void> {
    for (const session of this.all()) {
      if (session.userId !== userId || session.tokenHash === keepTokenHash) continue;
      if (isSessionExpired(session, at)) this.sessions.delete(session.tokenHash);
      else if (session.endedAt === null) {
        this.sessions.set(session.tokenHash, endSignInSession(session, reason, at));
      }
    }
    return Promise.resolve();
  }

  touch(tokenHash: string, at: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session?.endedAt === null) this.sessions.set(tokenHash, touchSession(session, at));
    return Promise.resolve();
  }

  delete(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }

  deleteAllForUser(userId: UserId): Promise<void> {
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(hash);
    }
    return Promise.resolve();
  }

  /** Test helper: every stored session. */
  all(): readonly Session[] {
    return [...this.sessions.values()];
  }
}

export class InMemoryPasswordCredentialRepository implements PasswordCredentialRepository {
  private readonly credentials = new Map<UserId, PasswordCredential>();

  findByUserId(userId: UserId): Promise<PasswordCredential | null> {
    return Promise.resolve(this.credentials.get(userId) ?? null);
  }

  save(credential: PasswordCredential): Promise<void> {
    this.credentials.set(credential.userId, credential);
    return Promise.resolve();
  }
}
