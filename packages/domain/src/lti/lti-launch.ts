import type { LtiPlatformId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { ltiClaim, ltiMessageType } from './lti-claims.ts';
import {
  placedItemOf,
  readDeepLinkingSettings,
  type LtiDeepLinkingErrorCode,
  type LtiDeepLinkingSettings,
  type LtiPlacedItem,
} from './lti-deep-linking.ts';
import { isSecureAddress, type LtiPlatform } from './lti-platform.ts';

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

/** A link opened from the course (resource link), or a teacher adding content (deep linking). */
export type LtiMessageKind = 'resourceLink' | 'deepLinking';

/** What a checked launch says: who launched, as what, and from which course. */
export interface LtiLaunch {
  readonly platformId: LtiPlatformId;
  readonly kind: LtiMessageKind;
  /** The course system's deployment the launch came from. */
  readonly deploymentId: string;
  /** The person's stable id in the course system (`sub`); never a name. */
  readonly subject: string;
  readonly role: LtiRole;
  readonly contextId: string | null;
  readonly contextTitle: string | null;
  readonly resourceLinkId: string | null;
  readonly givenName: string | null;
  /** The course system's language for the page (such as `es-PR`), when it sent one. */
  readonly locale: string | null;
  /** Where the course's class list can be read (Names and Role Provisioning), when offered. */
  readonly membershipsUrl: string | null;
  /** The assignment or game a placed link opens, when the launched link is one. */
  readonly placedItem: LtiPlacedItem | null;
  /** What a deep linking request asks for; null for a resource link launch. */
  readonly deepLinking: LtiDeepLinkingSettings | null;
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
  | 'missing_subject'
  | 'learner_deep_linking'
  | LtiDeepLinkingErrorCode;

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
  if (kindOf(claims[ltiClaim.messageType]) === null) return 'wrong_message_type';
  const deployment = claims[ltiClaim.deploymentId];
  if (typeof deployment !== 'string' || !ctx.platform.deploymentIds.includes(deployment)) {
    return 'unknown_deployment';
  }
  return text(claims.sub) === null ? 'missing_subject' : null;
}

/** The class list address, only when it is https (or this computer's, in tests). */
function membershipsUrlOf(service: unknown): string | null {
  const url = field(service, 'context_memberships_url');
  return url !== null && isSecureAddress(url) ? url : null;
}

function kindOf(messageType: unknown): LtiMessageKind | null {
  if (messageType === ltiMessageType.resourceLink) return 'resourceLink';
  return messageType === ltiMessageType.deepLinking ? 'deepLinking' : null;
}

/** A deep linking request's settings: only a teacher may add content, and only where it can go. */
function deepLinkingOf(
  claims: Claims,
  role: LtiRole,
): Result<LtiDeepLinkingSettings | null, LtiLaunchError> {
  if (kindOf(claims[ltiClaim.messageType]) !== 'deepLinking') return ok(null);
  if (role === 'learner') return fail('learner_deep_linking');
  const settings = readDeepLinkingSettings(claims[ltiClaim.deepLinkingSettings]);
  return settings.ok ? settings : fail(settings.error);
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
 * party, the times, the nonce, the LTI version and message type, the deployment and the user. A
 * deep linking request must come from a teacher, with settings TeacherHubPro can answer. Replays are stopped by the caller, which marks the nonce used.
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
  const role = roleOf(claims[ltiClaim.roles]);
  const deepLinking = deepLinkingOf(claims, role);
  if (!deepLinking.ok) return deepLinking;
  const context = claims[ltiClaim.context];
  return ok({
    platformId: ctx.platform.id,
    kind: deepLinking.value === null ? 'resourceLink' : 'deepLinking',
    deploymentId: String(claims[ltiClaim.deploymentId]),
    subject: text(claims.sub) ?? '',
    role,
    contextId: field(context, 'id'),
    contextTitle: field(context, 'title'),
    resourceLinkId: field(claims[ltiClaim.resourceLink], 'id'),
    givenName: text(claims.given_name),
    locale: field(claims[ltiClaim.launchPresentation], 'locale'),
    membershipsUrl: membershipsUrlOf(claims[ltiClaim.namesRoleService]),
    placedItem: placedItemOf(claims[ltiClaim.custom]),
    deepLinking: deepLinking.value,
    expiresAt: new Date(Number(claims.exp) * 1000),
  });
}
