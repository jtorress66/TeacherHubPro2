import {
  deviceFromUserAgent,
  isBrowserKey,
  isOsKey,
  ok,
  type DeviceKeys,
  type Result,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import type { Clock, TicketSigner, UsedTicketRepository, UserRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';
import {
  SignInGate,
  signInConfirmPurpose,
  type SignInBrowser,
  type SignInStep,
} from './sign-in-gate.ts';

interface SignInTicket {
  readonly ticketId: string;
  readonly expiresAt: Date;
  readonly userId: UserId;
  readonly schoolId: SchoolId;
  readonly lastSeenAt: Date;
  readonly device: DeviceKeys | null;
}

function readTicket(
  deps: { readonly ticketSigner: TicketSigner; readonly clock: Clock },
  ticket: string,
): SignInTicket | null {
  const payload = deps.ticketSigner.verify(ticket, deps.clock.now());
  if (payload?.purpose !== signInConfirmPurpose) return null;
  const { ticketId, expiresAt, userId, schoolId, lastSeenAt, browser, os } = payload;
  if (ticketId === undefined || expiresAt === undefined) return null;
  if (userId === undefined || schoolId === undefined || lastSeenAt === undefined) return null;
  return {
    ticketId,
    expiresAt: new Date(expiresAt),
    userId: userId as UserId,
    schoolId: schoolId as SchoolId,
    lastSeenAt: new Date(lastSeenAt),
    device: isBrowserKey(browser) && isOsKey(os) ? { browser, os } : null,
  };
}

export interface SignInConfirmation {
  /** The other device, or null when it was signed in before devices were recorded. */
  readonly device: DeviceKeys | null;
  /** Whole minutes since the other device was last active. */
  readonly minutesAgo: number;
}

/** What the "already signed in on another device" page says, from its ticket. */
export class DescribeSignInConfirmation {
  constructor(
    private readonly deps: { readonly ticketSigner: TicketSigner; readonly clock: Clock },
  ) {}

  execute(input: { readonly ticket: string }): Promise<Result<SignInConfirmation, UseCaseError>> {
    const ticket = readTicket(this.deps, input.ticket);
    if (ticket === null) return Promise.resolve(fail('sign_in_expired'));
    const elapsed = this.deps.clock.now().getTime() - ticket.lastSeenAt.getTime();
    return Promise.resolve(
      ok({ device: ticket.device, minutesAgo: Math.max(0, Math.floor(elapsed / 60_000)) }),
    );
  }
}

export interface ConfirmSignInDeps extends SessionIssuerDeps {
  readonly ticketSigner: TicketSigner;
  readonly users: UserRepository;
  readonly usedTickets: UsedTicketRepository;
}

/**
 * The person a ticket signs in, unless it is not genuine or current, was used before, or they are
 * suspended. Only a ticket that passes every check is used up.
 */
async function ticketUser(
  deps: ConfirmSignInDeps,
  ticket: string,
): Promise<Result<User, UseCaseError>> {
  const read = readTicket(deps, ticket);
  if (read === null) return fail('sign_in_expired');
  const user = await deps.users.findById(read.schoolId, read.userId);
  if (user === null) return fail('sign_in_expired');
  if (user.suspendedAt !== null) return fail('account_suspended');
  const first = await deps.usedTickets.claim(read.ticketId, read.expiresAt);
  return first ? ok(user) : fail('sign_in_expired');
}

/**
 * "Continue here": with a genuine, unexpired ticket, signs this browser in and signs every other
 * device of the account out. A suspended account is still refused.
 */
export class ConfirmSignIn {
  private readonly issuer: SessionIssuer;

  constructor(private readonly deps: ConfirmSignInDeps) {
    this.issuer = new SessionIssuer(deps);
  }

  async execute(input: {
    readonly ticket: string;
    readonly userAgent: string | null;
  }): Promise<Result<{ readonly user: User; readonly sessionToken: string }, UseCaseError>> {
    const user = await ticketUser(this.deps, input.ticket);
    if (!user.ok) return user;
    const device = deviceFromUserAgent(input.userAgent);
    return ok({ user: user.value, sessionToken: await this.issuer.issue(user.value, device) });
  }
}

/**
 * Asks again, now with the browser's own session cookie. A course system posts its launch from
 * another site, so the browser does not send its cookie then; back on this site it does, and a
 * browser already signed in to the account goes straight in.
 */
export class ResumeSignIn {
  private readonly gate: SignInGate;

  constructor(private readonly deps: ConfirmSignInDeps) {
    this.gate = new SignInGate(deps);
  }

  async execute(input: {
    readonly ticket: string;
    readonly browser: SignInBrowser;
  }): Promise<Result<SignInStep, UseCaseError>> {
    const user = await ticketUser(this.deps, input.ticket);
    if (!user.ok) return user;
    return ok(await this.gate.admit(user.value, input.browser));
  }
}
