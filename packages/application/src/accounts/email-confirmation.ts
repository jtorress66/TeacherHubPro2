import {
  confirmEmail,
  hasConfirmedEmail,
  issueEmailConfirmation,
  ok,
  rateRules,
  usableEmailConfirmation,
  useEmailConfirmation,
  type Result,
  type User,
} from '@thp/domain';
import type {
  Clock,
  EmailConfirmationRepository,
  Mailer,
  MailTemplates,
  RandomTokenGenerator,
  RateLimiter,
  TokenHasher,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

export interface ConfirmationLinkDeps {
  readonly emailConfirmations: EmailConfirmationRepository;
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly clock: Clock;
  readonly mailer: Mailer;
  readonly mailTemplates: MailTemplates;
  /** The site's address, for the link. */
  readonly appUrl: string;
}

/**
 * Emails a one-time "confirm your email" link. Older links stop working. The secret is in the
 * link's #hash, so it never reaches a server log; only its hash is stored.
 */
export class ConfirmationLinks {
  constructor(private readonly deps: ConfirmationLinkDeps) {}

  async send(user: User): Promise<Result<true, UseCaseError>> {
    const now = this.deps.clock.now();
    await this.deps.emailConfirmations.revokeFor(user.id, now);
    const secret = this.deps.tokens.generate();
    await this.deps.emailConfirmations.save(
      issueEmailConfirmation({
        userId: user.id,
        tokenHash: await this.deps.tokenHasher.hash(secret),
        now,
      }),
    );
    const sent = await this.deps.mailer.send({
      to: user.email,
      ...this.deps.mailTemplates.confirmEmail({
        language: user.language,
        name: user.name,
        url: `${this.deps.appUrl}/${user.language}/confirm-email#${secret}`,
      }),
    });
    return sent.ok ? ok(true) : fail('email_failed');
  }
}

/** The signed-in person asks for a new link: at most 5 a day per account. */
export class ResendEmailConfirmation {
  private readonly links: ConfirmationLinks;

  constructor(private readonly deps: ConfirmationLinkDeps & { readonly rateLimiter: RateLimiter }) {
    this.links = new ConfirmationLinks(deps);
  }

  async execute(input: {
    actor: User;
  }): Promise<Result<'sent' | 'already_confirmed', UseCaseError>> {
    if (hasConfirmedEmail(input.actor)) return ok('already_confirmed');
    const allowed = await this.deps.rateLimiter.hit({
      key: await this.deps.tokenHasher.hash(`confirmEmailResend:${input.actor.id}`),
      ...rateRules.confirmEmailResend,
      at: this.deps.clock.now(),
    });
    if (!allowed) return fail('resend_limit');
    const sent = await this.links.send(input.actor);
    return sent.ok ? ok('sent') : sent;
  }
}

/** Confirms the email from the link: valid once, before it expires. No sign-in needed. */
export class ConfirmEmail {
  constructor(
    private readonly deps: {
      readonly emailConfirmations: EmailConfirmationRepository;
      readonly tokenHasher: TokenHasher;
      readonly users: UserRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { token: string }): Promise<Result<User, UseCaseError>> {
    const now = this.deps.clock.now();
    const found =
      input.token.trim() === ''
        ? null
        : await this.deps.emailConfirmations.findByHash(
            await this.deps.tokenHasher.hash(input.token),
          );
    if (found === null || !usableEmailConfirmation(found.confirmation, now)) {
      return fail('invalid_link');
    }
    const user = await this.deps.users.findById(found.schoolId, found.confirmation.userId);
    if (user === null) return fail('invalid_link');
    const confirmed = confirmEmail(user, now);
    await this.deps.users.save(confirmed);
    await this.deps.emailConfirmations.save(useEmailConfirmation(found.confirmation, now));
    await this.deps.emailConfirmations.revokeFor(user.id, now);
    return ok(confirmed);
  }
}
