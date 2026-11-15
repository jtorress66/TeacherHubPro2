import { confirmEmail, ok, type Result } from '@thp/domain';
import type { BlockedDomainRepository, GoogleIdentity, GoogleProfile } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { AccountCreator, type Account, type AccountCreatorDeps } from './account-creator.ts';
import { findSchoolSubscription } from './school-subscription.ts';
import {
  SignInGate,
  type SignInBrowser,
  type SignInGateDeps,
  type SignInStep,
} from './sign-in-gate.ts';
import { checkNewAccountEmail } from './sign-up.ts';

export interface SignInWithGoogleDeps extends AccountCreatorDeps, SignInGateDeps {
  readonly google: GoogleIdentity;
  readonly blockedDomains: BlockedDomainRepository;
}

export interface GoogleSignInInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly language: string;
  readonly defaultSchoolName: string;
  readonly browser: SignInBrowser;
}

export interface GoogleSignedIn extends Account {
  readonly signIn: SignInStep;
  /** True when this sign-in created the account. */
  readonly created: boolean;
}

/**
 * Signs in with Google: an existing account with the same verified email, or a new one. Google
 * has verified the address, so the account's email counts as confirmed. Suspended accounts and new
 * accounts at a blocked domain are refused.
 */
export class SignInWithGoogle {
  private readonly accounts: AccountCreator;
  private readonly gate: SignInGate;

  constructor(private readonly deps: SignInWithGoogleDeps) {
    this.accounts = new AccountCreator(deps);
    this.gate = new SignInGate(deps);
  }

  async execute(input: GoogleSignInInput): Promise<Result<GoogleSignedIn, UseCaseError>> {
    const profile = await this.deps.google.exchangeCode(input.code, input.redirectUri);
    if (!profile.ok) return fail('google_failed');
    if (!profile.value.emailVerified) return fail('google_email_unverified');

    const existing = await this.existingAccount(profile.value);
    if (existing === null) {
      const allowed = await checkNewAccountEmail(this.deps.blockedDomains, profile.value.email);
      if (!allowed.ok) return allowed;
    }
    const account = existing ?? (await this.newAccount(profile.value, input));
    if (!account.ok) return account;
    const signIn = await this.gate.admit(account.value.user, input.browser);
    return ok({ ...account.value, signIn, created: existing === null });
  }

  private async existingAccount(
    profile: GoogleProfile,
  ): Promise<Result<Account, UseCaseError> | null> {
    const found = await this.deps.users.findByEmail(profile.email);
    if (!found) return null;
    if (found.suspendedAt !== null) return fail('account_suspended');
    const pictured = found.picture === null ? { ...found, picture: profile.picture } : found;
    const user = confirmEmail(pictured, this.deps.clock.now());
    if (user !== found) await this.deps.users.save(user);
    const school = await this.deps.schools.findById(user.schoolId);
    const subscription = await findSchoolSubscription(this.deps.subscriptions, user.schoolId);
    if (!school || !subscription) return fail('not_found');
    return ok({ user, school, subscription });
  }

  private newAccount(profile: GoogleProfile, input: GoogleSignInInput) {
    return this.accounts.create({
      email: profile.email,
      name: profile.name.trim() === '' ? profile.email : profile.name,
      language: input.language,
      picture: profile.picture,
      defaultSchoolName: input.defaultSchoolName,
      emailConfirmedAt: this.deps.clock.now(),
    });
  }
}
