import { ok, parseEmail, type Result, type User } from '@thp/domain';
import type { PasswordCredentialRepository, PasswordHasher, UserRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import {
  SignInGate,
  type SignInBrowser,
  type SignInGateDeps,
  type SignInStep,
} from './sign-in-gate.ts';

export interface LogInDeps extends SignInGateDeps {
  readonly users: UserRepository;
  readonly credentials: PasswordCredentialRepository;
  readonly passwordHasher: PasswordHasher;
}

export interface LoggedIn {
  readonly user: User;
  readonly signIn: SignInStep;
}

export class LogIn {
  private readonly gate: SignInGate;
  /** Checked when there is no password to compare, so failed logins take the same time either way. */
  private decoyHash: Promise<string> | undefined;

  constructor(private readonly deps: LogInDeps) {
    this.gate = new SignInGate(deps);
  }

  async execute(input: {
    email: string;
    password: string;
    browser: SignInBrowser;
  }): Promise<Result<LoggedIn, UseCaseError>> {
    const email = parseEmail('email', input.email);
    const user = email.ok ? await this.deps.users.findByEmail(email.value) : null;
    const credential = user ? await this.deps.credentials.findByUserId(user.id) : null;
    this.decoyHash ??= this.deps.passwordHasher.hash('decoy password for unknown accounts');
    const hash = credential?.passwordHash ?? (await this.decoyHash);
    const matches = await this.deps.passwordHasher.verify(input.password, hash);
    if (!user || !credential || !matches) return fail('invalid_credentials');
    // Only told after the right password, so a suspension never reveals that an account exists.
    if (user.suspendedAt !== null) return fail('account_suspended');

    if (this.deps.passwordHasher.needsRehash(credential.passwordHash)) {
      const passwordHash = await this.deps.passwordHasher.hash(input.password);
      await this.deps.credentials.save({ userId: user.id, passwordHash });
    }
    // Asked only now, after the right password, so it never reveals that an account exists.
    return ok({ user, signIn: await this.gate.admit(user, input.browser) });
  }
}
