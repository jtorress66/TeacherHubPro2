import type { SessionRepository, TokenHasher } from '@thp/ports';

export class LogOut {
  constructor(
    private readonly deps: {
      readonly sessions: SessionRepository;
      readonly tokenHasher: TokenHasher;
    },
  ) {}

  async execute(sessionToken: string): Promise<void> {
    await this.deps.sessions.delete(await this.deps.tokenHasher.hash(sessionToken));
  }
}
