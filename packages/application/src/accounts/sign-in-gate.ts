import { deviceFromUserAgent, otherActiveSession, type DeviceKeys, type User } from '@thp/domain';
import type { TicketSigner } from '@thp/ports';
import { SessionIssuer, type SessionIssuerDeps } from './session-issuer.ts';

/** The browser a sign-in comes from: its current session cookie, if any, and its user agent. */
export interface SignInBrowser {
  readonly sessionToken: string | null;
  readonly userAgent: string | null;
}

/**
 * How a sign-in goes on once the person is known: signed in straight away, or (the account is in
 * use on another device) a short-lived ticket to confirm with, so the password is not sent again.
 */
export type SignInStep =
  | { readonly kind: 'signedIn'; readonly sessionToken: string }
  | {
      readonly kind: 'confirm';
      readonly ticket: string;
      /** Null for a session started before devices were recorded. */
      readonly otherDevice: DeviceKeys | null;
      readonly otherLastSeenAt: Date;
    };

/** The person has this long to choose "Continue here". */
export const signInConfirmTicketLifetimeMs = 5 * 60 * 1000;

export const signInConfirmPurpose = 'replace-session';

export interface SignInGateDeps extends SessionIssuerDeps {
  readonly ticketSigner: TicketSigner;
}

/**
 * One sign-in per account. Asked only after the person is verified: if the account was active on
 * another browser in the last 30 minutes, it asks first; otherwise it signs in, ending the others.
 */
export class SignInGate {
  private readonly issuer: SessionIssuer;

  constructor(private readonly deps: SignInGateDeps) {
    this.issuer = new SessionIssuer(deps);
  }

  async admit(user: User, browser: SignInBrowser): Promise<SignInStep> {
    const now = this.deps.clock.now();
    const own =
      browser.sessionToken === null ? null : await this.deps.tokenHasher.hash(browser.sessionToken);
    const active = await this.deps.sessions.listActiveForUser(user.id, now);
    const other = otherActiveSession(active, own, now);
    if (other === null) {
      const device = deviceFromUserAgent(browser.userAgent);
      return { kind: 'signedIn', sessionToken: await this.issuer.issue(user, device) };
    }
    const expiresAt = new Date(now.getTime() + signInConfirmTicketLifetimeMs);
    const ticket = this.deps.ticketSigner.sign(
      {
        purpose: signInConfirmPurpose,
        // Recorded when the ticket is used, so it signs someone in only once.
        ticketId: this.deps.tokens.generate(),
        expiresAt: expiresAt.toISOString(),
        userId: user.id,
        schoolId: user.schoolId,
        lastSeenAt: other.lastSeenAt.toISOString(),
        ...(other.device ?? {}),
      },
      expiresAt,
    );
    return {
      kind: 'confirm',
      ticket,
      otherDevice: other.device,
      otherLastSeenAt: other.lastSeenAt,
    };
  }
}
