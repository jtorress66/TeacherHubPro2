import {
  checkPassword,
  isThrowawayEmail,
  matchesBlockedDomain,
  ok,
  parseEmail,
  requiredText,
  type Email,
  type Result,
} from '@thp/domain';
import type {
  BlockedDomainRepository,
  PasswordCredentialRepository,
  PasswordHasher,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { AccountCreator, type Account, type AccountCreatorDeps } from './account-creator.ts';
import { ConfirmationLinks, type ConfirmationLinkDeps } from './email-confirmation.ts';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';

export interface SignUpDeps extends AccountCreatorDeps, SessionIssuerDeps, ConfirmationLinkDeps {
  readonly credentials: PasswordCredentialRepository;
  readonly passwordHasher: PasswordHasher;
  readonly blockedDomains: BlockedDomainRepository;
}

export interface SignUpInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly language: string;
  readonly defaultSchoolName: string;
  /** "I am 18 or older and a teacher, school staff member, tutor or parent." */
  readonly adult: boolean;
}

export interface SignedIn extends Account {
  readonly sessionToken: string;
}

/** A blocked domain (such as a school's student addresses) cannot make new accounts. */
export async function checkNewAccountEmail(
  blockedDomains: BlockedDomainRepository,
  email: Email,
): Promise<Result<true, UseCaseError>> {
  if (
    matchesBlockedDomain(
      email,
      (await blockedDomains.list()).map((b) => b.domain),
    )
  ) {
    return fail('blocked_domain');
  }
  return ok(true);
}

/**
 * Creates a teacher with their own school on a 7-day trial, signs them in, and emails a link to
 * confirm their address (the AI tools wait for it).
 */
export class SignUp {
  private readonly accounts: AccountCreator;
  private readonly sessions: SessionIssuer;
  private readonly confirmations: ConfirmationLinks;

  constructor(private readonly deps: SignUpDeps) {
    this.accounts = new AccountCreator(deps);
    this.sessions = new SessionIssuer(deps);
    this.confirmations = new ConfirmationLinks(deps);
  }

  async execute(input: SignUpInput): Promise<Result<SignedIn, UseCaseError>> {
    if (!input.adult) return fail('adult_required');
    const email = parseEmail('email', input.email);
    if (!email.ok) return email;
    if (isThrowawayEmail(email.value)) return fail('throwaway_email');
    const allowed = await checkNewAccountEmail(this.deps.blockedDomains, email.value);
    if (!allowed.ok) return allowed;
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
      emailConfirmedAt: null,
    });
    if (!account.ok) return account;
    const passwordHash = await this.deps.passwordHasher.hash(password.value);
    await this.deps.credentials.save({ userId: account.value.user.id, passwordHash });
    // A failed email does not undo the account: the banner in the app can resend it.
    await this.confirmations.send(account.value.user);
    const sessionToken = await this.sessions.issue(account.value.user);
    return ok({ ...account.value, sessionToken });
  }
}
