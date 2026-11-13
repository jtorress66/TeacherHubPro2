import {
  checkLaunch,
  err,
  ok,
  type Language,
  type LtiLaunchErrorCode,
  type LtiPlatform,
  type LtiPlatformId,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type {
  LtiNonceRepository,
  LtiPlatformRepository,
  LtiTokenVerifier,
  LtiUserLinkRepository,
  RandomTokenGenerator,
  TicketSigner,
  UserRepository,
  Clock,
} from '@thp/ports';
import { SessionIssuer, type SessionIssuerDeps } from '../accounts/session-issuer.ts';

/** Why a launch or a link could not go ahead; the web app shows a friendly page for each. */
export type LtiErrorCode =
  | LtiLaunchErrorCode
  | 'invalid_request'
  | 'unknown_platform'
  | 'ambiguous_platform'
  | 'state_mismatch'
  | 'invalid_token'
  | 'replayed'
  | 'account_suspended'
  | 'link_expired'
  | 'forbidden';

export interface LtiError {
  readonly code: LtiErrorCode;
}

const refuse = (code: LtiErrorCode) => err<LtiError>({ code });

/** A teacher has this long, after a first launch, to sign in and link their account. */
export const ltiLinkTicketLifetimeMs = 15 * 60 * 1000;

const linkPurpose = 'lti-link';

/** The OIDC login a course system starts (third-party initiated login). */
export interface LtiLoginRequest {
  readonly issuer: string;
  readonly loginHint: string;
  readonly targetLinkUri: string;
  readonly ltiMessageHint: string | null;
  readonly clientId: string | null;
  readonly deploymentId: string | null;
}

/** What the browser keeps (in a short-lived cookie) between the login and the launch. */
export interface SavedLtiLogin {
  readonly state: string;
  readonly nonce: string;
  readonly platformId: LtiPlatformId;
  readonly schoolId: SchoolId;
}

export interface StartedLtiLogin extends SavedLtiLogin {
  /** The course system's sign-in address, with the authentication request. */
  readonly redirectUrl: string;
}

const blank = (value: string | null) => value === null || value.trim() === '';

/**
 * Answers a course system's login: finds the registered platform and sends the browser to its
 * sign-in with a fresh state (against forged launches) and nonce (against replays).
 */
export class StartLtiLogin {
  constructor(
    private readonly deps: {
      readonly ltiPlatforms: LtiPlatformRepository;
      readonly tokens: RandomTokenGenerator;
      readonly appUrl: string;
    },
  ) {}

  async execute(input: LtiLoginRequest): Promise<Result<StartedLtiLogin, LtiError>> {
    if (blank(input.issuer) || blank(input.loginHint) || blank(input.targetLinkUri)) {
      return refuse('invalid_request');
    }
    const clientId = blank(input.clientId) ? null : input.clientId;
    const found = await this.deps.ltiPlatforms.findByIssuer(input.issuer, clientId);
    const [platform, ...others] = found;
    if (platform === undefined) return refuse('unknown_platform');
    if (others.length > 0) return refuse('ambiguous_platform');
    const deployment = input.deploymentId;
    if (deployment !== null && !blank(deployment) && !platform.deploymentIds.includes(deployment)) {
      return refuse('unknown_deployment');
    }
    const state = this.deps.tokens.generate();
    const nonce = this.deps.tokens.generate();
    return ok({
      state,
      nonce,
      platformId: platform.id,
      schoolId: platform.schoolId,
      redirectUrl: this.authenticationRequest(platform, input, state, nonce),
    });
  }

  private authenticationRequest(
    platform: LtiPlatform,
    input: LtiLoginRequest,
    state: string,
    nonce: string,
  ): string {
    const url = new URL(platform.authLoginUrl);
    const params: [string, string][] = [
      ['scope', 'openid'],
      ['response_type', 'id_token'],
      ['response_mode', 'form_post'],
      ['prompt', 'none'],
      ['client_id', platform.clientId],
      ['redirect_uri', `${this.deps.appUrl}/api/lti/launch`],
      ['login_hint', input.loginHint],
      ...(input.ltiMessageHint === null
        ? []
        : ([['lti_message_hint', input.ltiMessageHint]] as [string, string][])),
      ['state', state],
      ['nonce', nonce],
    ];
    for (const [name, value] of params) url.searchParams.set(name, value);
    return url.toString();
  }
}

export type LtiLaunchOutcome =
  | { readonly kind: 'signedIn'; readonly sessionToken: string; readonly language: Language }
  | {
      readonly kind: 'needsLink';
      /** Signed and short-lived: which course system user is waiting to be linked. */
      readonly ticket: string;
      readonly locale: string | null;
    }
  | { readonly kind: 'learnerNotYet'; readonly locale: string | null };

export interface CompleteLtiLaunchDeps extends SessionIssuerDeps {
  readonly ltiPlatforms: LtiPlatformRepository;
  readonly ltiTokenVerifier: LtiTokenVerifier;
  readonly ltiNonces: LtiNonceRepository;
  readonly ltiUserLinks: LtiUserLinkRepository;
  readonly users: UserRepository;
  readonly ticketSigner: TicketSigner;
}

/**
 * Finishes a launch: the state must match the login, the token must be signed by the course
 * system and pass every launch check, and its nonce works once. A linked teacher is signed in
 * (unless suspended); a teacher not linked yet gets a ticket to link their account after signing
 * in; students are not served yet, and nothing about them is kept.
 */
export class CompleteLtiLaunch {
  private readonly sessions: SessionIssuer;

  constructor(private readonly deps: CompleteLtiLaunchDeps) {
    this.sessions = new SessionIssuer(deps);
  }

  async execute(input: {
    readonly idToken: string;
    readonly state: string;
    readonly saved: SavedLtiLogin | null;
  }): Promise<Result<LtiLaunchOutcome, LtiError>> {
    const { saved } = input;
    if (saved?.state !== input.state) return refuse('state_mismatch');
    const platform = await this.deps.ltiPlatforms.findById(saved.schoolId, saved.platformId);
    if (platform === null) return refuse('unknown_platform');
    const claims = await this.deps.ltiTokenVerifier.verify(input.idToken, {
      jwksUrl: platform.jwksUrl,
      issuer: platform.issuer,
      audience: platform.clientId,
    });
    if (!claims.ok) return refuse('invalid_token');
    const now = this.deps.clock.now();
    const launch = checkLaunch(claims.value, { platform, expectedNonce: saved.nonce, now });
    if (!launch.ok) return launch;
    if (!(await this.deps.ltiNonces.claim(saved.nonce, launch.value.expiresAt))) {
      return refuse('replayed');
    }
    const { locale, subject } = launch.value;
    if (launch.value.role === 'learner') return ok({ kind: 'learnerNotYet', locale });

    const userId = await this.deps.ltiUserLinks.findUserId(platform.id, subject);
    const user = userId === null ? null : await this.deps.users.findById(platform.schoolId, userId);
    if (user === null) {
      const ticket = this.deps.ticketSigner.sign(
        { purpose: linkPurpose, platformId: platform.id, subject, schoolId: platform.schoolId },
        new Date(now.getTime() + ltiLinkTicketLifetimeMs),
      );
      return ok({ kind: 'needsLink', ticket, locale });
    }
    if (user.suspendedAt !== null) return refuse('account_suspended');
    return ok({
      kind: 'signedIn',
      sessionToken: await this.sessions.issue(user),
      language: user.language,
    });
  }
}

interface LinkDeps {
  readonly ltiPlatforms: LtiPlatformRepository;
  readonly ltiUserLinks: LtiUserLinkRepository;
  readonly ticketSigner: TicketSigner;
  readonly clock: Clock;
}

interface LinkTicket {
  readonly platformId: LtiPlatformId;
  readonly subject: string;
  readonly schoolId: SchoolId;
}

function readLinkTicket(deps: LinkDeps, ticket: string): LinkTicket | null {
  const payload = deps.ticketSigner.verify(ticket, deps.clock.now());
  if (payload?.purpose !== linkPurpose) return null;
  const { platformId, subject, schoolId } = payload;
  if (platformId === undefined || subject === undefined || schoolId === undefined) return null;
  return { platformId: platformId as LtiPlatformId, subject, schoolId: schoolId as SchoolId };
}

async function platformOf(
  deps: LinkDeps,
  ticket: string,
): Promise<Result<{ readonly link: LinkTicket; readonly platform: LtiPlatform }, LtiError>> {
  const link = readLinkTicket(deps, ticket);
  if (link === null) return refuse('link_expired');
  const platform = await deps.ltiPlatforms.findById(link.schoolId, link.platformId);
  return platform === null ? refuse('unknown_platform') : ok({ link, platform });
}

/** The course system a link ticket is for, to name it on the linking page. */
export class DescribeLtiLink {
  constructor(private readonly deps: LinkDeps) {}

  async execute(input: {
    readonly ticket: string;
  }): Promise<Result<{ readonly platformName: string }, LtiError>> {
    const found = await platformOf(this.deps, input.ticket);
    return found.ok ? ok({ platformName: found.value.platform.name }) : found;
  }
}

/**
 * Links the signed-in person's account to the course system user in the ticket, so later launches
 * sign them straight in. Only an account of the course system's own school can be linked.
 */
export class LinkLtiAccount {
  constructor(private readonly deps: LinkDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly ticket: string;
  }): Promise<Result<{ readonly platformName: string }, LtiError>> {
    const found = await platformOf(this.deps, input.ticket);
    if (!found.ok) return found;
    const { link, platform } = found.value;
    if (input.actor.schoolId !== platform.schoolId) return refuse('forbidden');
    await this.deps.ltiUserLinks.link(
      platform.id,
      link.subject,
      input.actor.id,
      this.deps.clock.now(),
    );
    return ok({ platformName: platform.name });
  }
}
