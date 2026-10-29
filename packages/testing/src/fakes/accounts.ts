import type { Session, UserId } from '@thp/domain';
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
