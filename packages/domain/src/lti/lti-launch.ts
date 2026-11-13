import type { LtiPlatformId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import type { LtiPlatform } from './lti-platform.ts';

const claimBase = 'https://purl.imsglobal.org/spec/lti/claim';

/** The LTI 1.3 claim names a launch is read from. */
export const ltiClaim = {
  version: `${claimBase}/version`,
  messageType: `${claimBase}/message_type`,
  deploymentId: `${claimBase}/deployment_id`,
  roles: `${claimBase}/roles`,
  context: `${claimBase}/context`,
  resourceLink: `${claimBase}/resource_link`,
  launchPresentation: `${claimBase}/launch_presentation`,
  targetLinkUri: `${claimBase}/target_link_uri`,
} as const;

const lis = 'http://purl.imsglobal.org/vocab/lis/v2';

/** The LIS roles that make someone a teacher here; every other role is a learner. */
export const ltiRoles = {
  instructor: `${lis}/membership#Instructor`,
  administrator: `${lis}/membership#Administrator`,
  institutionInstructor: `${lis}/institution/person#Instructor`,
  institutionAdministrator: `${lis}/institution/person#Administrator`,
  institutionFaculty: `${lis}/institution/person#Faculty`,
} as const;

const teacherRoles: ReadonlySet<string> = new Set(Object.values(ltiRoles));

export type LtiRole = 'teacher' | 'learner';

/** What a checked launch says: who launched, as what, and from which course. */
export interface LtiLaunch {
  readonly platformId: LtiPlatformId;
  /** The person's stable id in the course system (`sub`); never a name. */
  readonly subject: string;
  readonly role: LtiRole;
  readonly contextId: string | null;
  readonly contextTitle: string | null;
  readonly resourceLinkId: string | null;
  readonly givenName: string | null;
  /** The course system's language for the page (such as `es-PR`), when it sent one. */
  readonly locale: string | null;
  /** When the launch token expires; its nonce must stay used until then. */
  readonly expiresAt: Date;
}

export type LtiLaunchErrorCode =
  | 'malformed'
  | 'wrong_issuer'
  | 'wrong_audience'
  | 'wrong_authorized_party'
  | 'expired'
  | 'issued_in_future'
  | 'wrong_nonce'
  | 'wrong_version'
  | 'wrong_message_type'
  | 'unknown_deployment'
  | 'missing_subject';

export interface LtiLaunchError {
  readonly code: LtiLaunchErrorCode;
}

export interface LaunchContext {
  readonly platform: LtiPlatform;
  /** The nonce this tool sent with the login; the launch must carry it back. */
  readonly expectedNonce: string;
  readonly now: Date;
}

/** A token issued up to five minutes ahead is accepted (clocks differ a little). */
const allowedClockSkewSeconds = 300;

type Claims = Readonly<Record<string, unknown>>;

const isClaims = (value: unknown): value is Claims =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const field = (value: unknown, name: string): string | null =>
  isClaims(value) ? text(value[name]) : null;

const fail = (code: LtiLaunchErrorCode) => err({ code });

function checkAudience(claims: Claims, clientId: string): LtiLaunchErrorCode | null {
  const { aud, azp } = claims;
  if (typeof aud === 'string') return aud === clientId ? null : 'wrong_audience';
  if (!Array.isArray(aud) || !aud.includes(clientId)) return 'wrong_audience';
  return aud.length > 1 && azp !== clientId ? 'wrong_authorized_party' : null;
}

function checkTimes(claims: Claims, now: Date): LtiLaunchErrorCode | null {
  const { exp, iat } = claims;
  if (typeof exp !== 'number' || typeof iat !== 'number') return 'malformed';
  const seconds = now.getTime() / 1000;
  if (exp <= seconds) return 'expired';
  return iat > seconds + allowedClockSkewSeconds ? 'issued_in_future' : null;
}

function checkMessage(claims: Claims, ctx: LaunchContext): LtiLaunchErrorCode | null {
  if (claims.nonce !== ctx.expectedNonce) return 'wrong_nonce';
  if (claims[ltiClaim.version] !== '1.3.0') return 'wrong_version';
  if (claims[ltiClaim.messageType] !== 'LtiResourceLinkRequest') return 'wrong_message_type';
  const deployment = claims[ltiClaim.deploymentId];
  if (typeof deployment !== 'string' || !ctx.platform.deploymentIds.includes(deployment)) {
    return 'unknown_deployment';
  }
  return text(claims.sub) === null ? 'missing_subject' : null;
}

function roleOf(roles: unknown): LtiRole {
  if (!Array.isArray(roles)) return 'learner';
  return roles.some((role) => typeof role === 'string' && teacherRoles.has(role))
    ? 'teacher'
    : 'learner';
}

/**
 * Checks the claims of a launch whose signature, issuer and audience a verifier has already
 * checked (checked again here, so nothing depends on it): the issuer, audience and authorized
 * party, the times, the nonce, the LTI version and message type, the deployment and the user.
 * Replays are stopped by the caller, which marks the nonce used.
 */
export function checkLaunch(
  claims: unknown,
  ctx: LaunchContext,
): Result<LtiLaunch, LtiLaunchError> {
  if (!isClaims(claims)) return fail('malformed');
  if (claims.iss !== ctx.platform.issuer) return fail('wrong_issuer');
  const problem =
    checkAudience(claims, ctx.platform.clientId) ??
    checkTimes(claims, ctx.now) ??
    checkMessage(claims, ctx);
  if (problem !== null) return fail(problem);
  const context = claims[ltiClaim.context];
  return ok({
    platformId: ctx.platform.id,
    subject: text(claims.sub) ?? '',
    role: roleOf(claims[ltiClaim.roles]),
    contextId: field(context, 'id'),
    contextTitle: field(context, 'title'),
    resourceLinkId: field(claims[ltiClaim.resourceLink], 'id'),
    givenName: text(claims.given_name),
    locale: field(claims[ltiClaim.launchPresentation], 'locale'),
    expiresAt: new Date(Number(claims.exp) * 1000),
  });
}
