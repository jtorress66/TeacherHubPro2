import { ok, parseEmail, type Result, type User } from '@thp/domain';
import type { PasswordCredentialRepository, PasswordHasher, UserRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';

export interface LogInDeps extends SessionIssuerDeps {
  readonly users: UserRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly passwordHasher: PasswordHasher;
}

export interface LoggedIn {
  readonly user: User;
  readonly sessionToken: string;
}

export class LogIn {
  private readonly sessions: SessionIssuer;
  /** Checked when there is no password to compare, so failed logins take the same time either way. */
  private decoyHash: Promise<string> | undefined;

  constructor(private readonly deps: LogInDeps) {
    this.sessions = new SessionIssuer(deps);
  }

  async execute(input: {
    email: string;
    password: string;
  }): Promise<Result<LoggedIn, UseCaseError>> {
    const email = parseEmail('email', input.email);
    const user = email.ok ? await this.deps.users.findByEmail(email.value) : null;
    const credential = user ? await this.deps.credentials.findByUserId(user.id) : null;
    this.decoyHash ??= this.deps.passwordHasher.hash('decoy password for unknown accounts');
    const hash = credential?.passwordHash ?? (await this.decoyHash);
    const matches = await this.deps.passwordHasher.verify(input.password, hash);
    if (!user || !credential || !matches) return fail('invalid_credentials');

    if (this.deps.passwordHasher.needsRehash(credential.passwordHash)) {
      const passwordHash = await this.deps.passwordHasher.hash(input.password);
      await this.deps.credentials.save({ userId: user.id, passwordHash });
    }
    return ok({ user, sessionToken: await this.sessions.issue(user) });
  }
}
