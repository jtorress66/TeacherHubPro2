import { ok, type Result } from '@thp/domain';
import type { GoogleIdentity, GoogleProfile } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { AccountCreator, type Account, type AccountCreatorDeps } from './account-creator.ts';
import { findSchoolSubscription } from './school-subscription.ts';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';
import type { SignedIn } from './sign-up.ts';

export interface SignInWithGoogleDeps extends AccountCreatorDeps, SessionIssuerDeps {
  readonly google: GoogleIdentity;
}

export interface GoogleSignInInput {
  readonly code: string;
  readonly redirectUri: string;
  readonly language: string;
  readonly defaultSchoolName: string;
}

export interface GoogleSignedIn extends SignedIn {
  /** True when this sign-in created the account. */
  readonly created: boolean;
}

/** Signs in with Google: an existing account with the same verified email, or a new one. */
export class SignInWithGoogle {
  private readonly accounts: AccountCreator;
  private readonly sessions: SessionIssuer;

  constructor(private readonly deps: SignInWithGoogleDeps) {
    this.accounts = new AccountCreator(deps);
    this.sessions = new SessionIssuer(deps);
  }

  async execute(input: GoogleSignInInput): Promise<Result<GoogleSignedIn, UseCaseError>> {
    const profile = await this.deps.google.exchangeCode(input.code, input.redirectUri);
    if (!profile.ok) return fail('google_failed');
    if (!profile.value.emailVerified) return fail('google_email_unverified');

    const existing = await this.existingAccount(profile.value);
    const account = existing ?? (await this.newAccount(profile.value, input));
    if (!account.ok) return account;
    const sessionToken = await this.sessions.issue(account.value.user);
    return ok({ ...account.value, sessionToken, created: existing === null });
  }

  private async existingAccount(
    profile: GoogleProfile,
  ): Promise<Result<Account, UseCaseError> | null> {
    const found = await this.deps.users.findByEmail(profile.email);
    if (!found) return null;
    const user = found.picture === null ? { ...found, picture: profile.picture } : found;
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
    });
  }
}
