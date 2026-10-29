import { startSession, type User } from '@thp/domain';
import type { Clock, RandomTokenGenerator, SessionRepository, TokenHasher } from '@thp/ports';

export interface SessionIssuerDeps {
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly sessions: SessionRepository;
  readonly clock: Clock;
}

/** Starts a session and returns its secret token; only the token's hash is stored. */
export class SessionIssuer {
  constructor(private readonly deps: SessionIssuerDeps) {}

  async issue(user: User): Promise<string> {
    const token = this.deps.tokens.generate();
    const tokenHash = await this.deps.tokenHasher.hash(token);
    await this.deps.sessions.save(
      startSession({
        tokenHash,
        userId: user.id,
        schoolId: user.schoolId,
        now: this.deps.clock.now(),
      }),
    );
    return token;
  }
}
