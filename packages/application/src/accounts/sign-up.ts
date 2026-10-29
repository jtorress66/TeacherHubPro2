import { checkPassword, ok, parseEmail, requiredText, type Result } from '@thp/domain';
import type { PasswordCredentialRepository, PasswordHasher } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { AccountCreator, type Account, type AccountCreatorDeps } from './account-creator.ts';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';

export interface SignUpDeps extends AccountCreatorDeps, SessionIssuerDeps {
  readonly credentials: PasswordCredentialRepository;
  readonly passwordHasher: PasswordHasher;
}

export interface SignUpInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly language: string;
  readonly defaultSchoolName: string;
}

export interface SignedIn extends Account {
  readonly sessionToken: string;
}

/** Creates a teacher with their own school on a 7-day trial, and signs them in. */
export class SignUp {
  private readonly accounts: AccountCreator;
  private readonly sessions: SessionIssuer;

  constructor(private readonly deps: SignUpDeps) {
    this.accounts = new AccountCreator(deps);
    this.sessions = new SessionIssuer(deps);
  }

  async execute(input: SignUpInput): Promise<Result<SignedIn, UseCaseError>> {
    const email = parseEmail('email', input.email);
    if (!email.ok) return email;
    const password = checkPassword(input.password, email.value);
    if (!password.ok) return password;
    const name = requiredText('name', input.name);
    if (!name.ok) return name;
    if (await this.deps.users.findByEmail(email.value)) return fail('email_taken');

    const account = await this.accounts.create({
      email: email.value,
      name: name.value,
      language: input.language,
      picture: null,
      defaultSchoolName: input.defaultSchoolName,
    });
    if (!account.ok) return account;
    const passwordHash = await this.deps.passwordHasher.hash(password.value);
    await this.deps.credentials.save({ userId: account.value.user.id, passwordHash });
    const sessionToken = await this.sessions.issue(account.value.user);
    return ok({ ...account.value, sessionToken });
  }
}
