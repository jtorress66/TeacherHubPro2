import {
  checkPassword,
  confirmEmail,
  issuePasswordToken,
  ok,
  parseEmail,
  usablePasswordToken,
  usePasswordToken,
  type PasswordTokenId,
  type PasswordTokenPurpose,
  type Result,
  type User,
  type UserId,
} from '@thp/domain';
import type {
  Clock,
  IdGenerator,
  Mailer,
  MailTemplates,
  PasswordCredentialRepository,
  PasswordHasher,
  PasswordTokenRepository,
  RandomTokenGenerator,
  TokenHasher,
  UserDirectory,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findManagedUser } from './admin-access.ts';

export interface PasswordLinkDeps {
  readonly passwordTokens: PasswordTokenRepository;
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly mailer: Mailer;
  readonly mailTemplates: MailTemplates;
  /** The site's address, for the link. */
  readonly appUrl: string;
}

/**
 * Emails a user a one-time link to choose a password. Older links stop working. The secret is in
 * the link's #hash, so it never reaches a server log; only its hash is stored.
 */
export class PasswordLinks {
  constructor(private readonly deps: PasswordLinkDeps) {}

  async send(user: User, purpose: PasswordTokenPurpose): Promise<Result<true, UseCaseError>> {
    const now = this.deps.clock.now();
    await this.deps.passwordTokens.revokeFor(user.id, now);
    const secret = this.deps.tokens.generate();
    await this.deps.passwordTokens.save(
      issuePasswordToken({
        id: this.deps.ids.next() as PasswordTokenId,
        userId: user.id,
        schoolId: user.schoolId,
        tokenHash: await this.deps.tokenHasher.hash(secret),
        purpose,
        now,
      }),
    );
    const url = `${this.deps.appUrl}/${user.language}/set-password#${secret}`;
    const sent = await this.deps.mailer.send({
      to: user.email,
      ...this.deps.mailTemplates.setPassword({
        language: user.language,
        name: user.name,
        url,
        purpose,
      }),
    });
    return sent.ok ? ok(true) : fail('email_failed');
  }
}

/**
 * "Forgot password?": emails a reset link when the address has an account. The answer is the
 * same either way, so nobody can learn which addresses have accounts.
 */
export class RequestPasswordReset {
  private readonly links: PasswordLinks;

  constructor(private readonly deps: PasswordLinkDeps & { readonly users: UserRepository }) {
    this.links = new PasswordLinks(deps);
  }

  async execute(input: { email: string }): Promise<Result<true, UseCaseError>> {
    const email = parseEmail('email', input.email);
    if (!email.ok) return email;
    const user = await this.deps.users.findByEmail(email.value);
    if (user !== null) await this.links.send(user, 'reset');
    return ok(true);
  }
}

/** An admin emails a set-password link to someone in a school they administer. */
export class SendPasswordLink {
  private readonly links: PasswordLinks;

  constructor(private readonly deps: PasswordLinkDeps & { readonly users: UserRepository }) {
    this.links = new PasswordLinks(deps);
  }

  async execute(input: {
    actor: User;
    userId: UserId;
    schoolId?: User['schoolId'];
  }): Promise<Result<true, UseCaseError>> {
    const user = await findManagedUser(this.deps.users, input.actor, input.userId, input.schoolId);
    if (!user.ok) return user;
    return this.links.send(user.value, 'reset');
  }
}

/**
 * Chooses a password from a link: valid once, before it expires; then the user logs in. The link
 * came by email, so the address is confirmed too.
 */
export class SetPassword {
  constructor(
    private readonly deps: {
      readonly passwordTokens: PasswordTokenRepository;
      readonly tokenHasher: TokenHasher;
      readonly users: UserRepository;
      readonly credentials: PasswordCredentialRepository;
      readonly passwordHasher: PasswordHasher;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { token: string; password: string }): Promise<Result<User, UseCaseError>> {
    const now = this.deps.clock.now();
    const token =
      input.token.trim() === ''
        ? null
        : await this.deps.passwordTokens.findByHash(await this.deps.tokenHasher.hash(input.token));
    if (token === null || !usablePasswordToken(token, now)) return fail('invalid_link');
    const user = await this.deps.users.findById(token.schoolId, token.userId);
    if (user === null) return fail('invalid_link');
    const password = checkPassword(input.password, user.email);
    if (!password.ok) return password;
    await this.deps.credentials.save({
      userId: user.id,
      passwordHash: await this.deps.passwordHasher.hash(password.value),
    });
    const confirmed = confirmEmail(user, now);
    if (confirmed !== user) await this.deps.users.save(confirmed);
    await this.deps.passwordTokens.save(usePasswordToken(token, now));
    await this.deps.passwordTokens.revokeFor(user.id, now);
    return ok(confirmed);
  }
}

/**
 * Makes an existing account the first super admin, with the key set on the server. It works only
 * while there is no super admin, and not at all when no key is set.
 */
export class SetUpFirstSuperAdmin {
  constructor(
    private readonly deps: {
      readonly users: UserRepository;
      readonly userDirectory: UserDirectory;
      readonly tokenHasher: TokenHasher;
      readonly setupKey: string | null;
    },
  ) {}

  async execute(input: { email: string; key: string }): Promise<Result<User, UseCaseError>> {
    const expected = this.deps.setupKey?.trim() ?? '';
    if (expected === '') return fail('setup_unavailable');
    if ((await this.deps.userDirectory.countByRole('super_admin')) > 0) {
      return fail('already_set_up');
    }
    const [given, wanted] = await Promise.all([
      this.deps.tokenHasher.hash(input.key),
      this.deps.tokenHasher.hash(expected),
    ]);
    if (given !== wanted) return fail('forbidden');
    const email = parseEmail('email', input.email);
    const user = email.ok ? await this.deps.users.findByEmail(email.value) : null;
    if (user === null) return fail('not_found');
    const promoted: User = { ...user, role: 'super_admin' };
    await this.deps.users.save(promoted);
    return ok(promoted);
  }
}
