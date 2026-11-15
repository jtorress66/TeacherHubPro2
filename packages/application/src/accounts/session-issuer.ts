import { startSession, type DeviceKeys, type User } from '@thp/domain';
import type { Clock, RandomTokenGenerator, SessionRepository, TokenHasher } from '@thp/ports';

export interface SessionIssuerDeps {
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly sessions: SessionRepository;
  readonly clock: Clock;
}

/**
 * Starts a session and returns its secret token; only the token's hash is stored. An account has
 * one sign-in at a time: every other session of the user ends, kept so its browser can be told.
 */
export class SessionIssuer {
  constructor(private readonly deps: SessionIssuerDeps) {}

  async issue(user: User, device: DeviceKeys | null): Promise<string> {
    const token = this.deps.tokens.generate();
    const tokenHash = await this.deps.tokenHasher.hash(token);
    const now = this.deps.clock.now();
    await this.deps.sessions.save(
      startSession({ tokenHash, userId: user.id, schoolId: user.schoolId, device, now }),
    );
    await this.deps.sessions.endAllForUserExcept(user.id, tokenHash, 'replaced', now);
    return token;
  }
}
