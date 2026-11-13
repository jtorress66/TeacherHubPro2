import { z } from 'zod';
import type { LtiErrorCode, LtiItemTarget, LtiLoginRequest, SavedLtiLogin } from '@thp/application';
import {
  ltiItemParams,
  placedItemOf,
  type LtiPlacedItem,
  type LtiPlatformId,
  type SchoolId,
} from '@thp/domain';
import { defaultLocale, isLocale, type Locale, type MessageKey } from '@thp/i18n';

/** The state, nonce and platform of a login, until its launch comes back (ten minutes). */
export const LTI_LOGIN_COOKIE = 'thp_lti_login';
/** The ticket of a launch waiting for its teacher to sign in and link (fifteen minutes). */
export const LTI_LINK_COOKIE = 'thp_lti_link';
/** The ticket of a course's "Add content" request, until the teacher chooses (thirty minutes). */
export const LTI_PLACE_COOKIE = 'thp_lti_place';

const secureFor = (appUrl: string) => appUrl.startsWith('https://');

const required = z.string().trim().min(1);
const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()));

const loginParams = z.object({
  iss: required,
  login_hint: required,
  target_link_uri: required,
  lti_message_hint: optional,
  client_id: optional,
  lti_deployment_id: optional,
});

/** A course system's OIDC login request (query or form), or null when it lacks what is needed. */
export function parseLtiLogin(params: URLSearchParams | FormData): LtiLoginRequest | null {
  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (typeof value === 'string') fields[key] = value;
  }
  const parsed = loginParams.safeParse(fields);
  if (!parsed.success) return null;
  const value = parsed.data;
  return {
    issuer: value.iss,
    loginHint: value.login_hint,
    targetLinkUri: value.target_link_uri,
    ltiMessageHint: value.lti_message_hint,
    clientId: value.client_id,
    deploymentId: value.lti_deployment_id,
  };
}

const savedLogin = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  platformId: z.string().min(1),
  schoolId: z.string().min(1),
});

export const encodeLtiLogin = (saved: SavedLtiLogin): string =>
  Buffer.from(JSON.stringify(saved)).toString('base64url');

export function decodeLtiLogin(value: string | undefined): SavedLtiLogin | null {
  if (value === undefined) return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = savedLogin.safeParse(json);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    platformId: parsed.data.platformId as LtiPlatformId,
    schoolId: parsed.data.schoolId as SchoolId,
  };
}

/**
 * The launch comes back as a form post from the course system's site, so over https the login
 * cookie must cross sites (SameSite=None, which browsers allow only with Secure). On plain http
 * (this computer, tests) the course system is the same site, so Lax works. Only the LTI routes
 * read it.
 */
export const ltiLoginCookieOptions = (appUrl: string) =>
  secureFor(appUrl)
    ? {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        path: '/api/lti',
        maxAge: 600,
      }
    : {
        httpOnly: true,
        secure: false,
        sameSite: 'lax' as const,
        path: '/api/lti',
        maxAge: 600,
      };

/** Read on our own pages after the launch (the linking page, logging in), so Lax is enough. */
export const ltiLinkCookieOptions = (appUrl: string) => ({
  httpOnly: true,
  secure: secureFor(appUrl),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 900,
});

/** Read on the picker page after the launch (or after linking), so Lax is enough. */
export const ltiPlaceCookieOptions = (appUrl: string) => ({
  httpOnly: true,
  secure: secureFor(appUrl),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 1800,
});

export const ltiProblems = [
  'not_set_up',
  'expired',
  'suspended',
  'wrong_school',
  'other_account',
  'failed',
] as const;

/** What a person is told when a launch or a link cannot go ahead. */
export type LtiProblem = (typeof ltiProblems)[number];

const problems: Partial<Record<LtiErrorCode, LtiProblem>> = {
  unknown_platform: 'not_set_up',
  ambiguous_platform: 'not_set_up',
  unknown_deployment: 'not_set_up',
  link_expired: 'expired',
  state_mismatch: 'expired',
  replayed: 'expired',
  expired: 'expired',
  account_suspended: 'suspended',
  forbidden: 'wrong_school',
};

/** The problem to show for a refusal; anything technical is a plain "try again". */
export const ltiProblemFor = (code: LtiErrorCode): LtiProblem => problems[code] ?? 'failed';

/** The problem an address names, or the plain one. */
export const ltiProblemFrom = (value: unknown): LtiProblem =>
  (ltiProblems as readonly unknown[]).includes(value) ? (value as LtiProblem) : 'failed';

/** Our language for the course system's (`es-PR` → `es`); English otherwise. */
export function localeFromLti(value: string | null): Locale {
  const language = value?.split(/[-_]/u)[0]?.toLowerCase();
  return isLocale(language) ? language : defaultLocale;
}

/** Where logging in leads: back to the linking page while a launch waits to be linked. */
export const afterLogInPath = (locale: Locale, pendingLink: boolean): string =>
  pendingLink ? `/${locale}/lti/link` : `/${locale}/app`;

/** Where linking leads: on to the picker while a course's "Add content" request waits. */
export const afterLinkPath = (locale: Locale, pendingPlace: boolean): string =>
  pendingPlace ? `/${locale}/app/lti/place` : `/${locale}/app`;

/** The app page a placed assignment or game opens on. */
export const ltiItemPath = (locale: Locale, target: LtiItemTarget): string =>
  target.kind === 'game'
    ? `/${locale}/app/games/${target.gameId}`
    : `/${locale}/app/classes/${target.classId}/assignments/${target.assignmentId}`;

/** An item as one checkbox or radio value. */
export const placedItemValue = (item: LtiPlacedItem): string => `${item.kind}:${item.id}`;

/** The items the picker's values name; anything else is left out. */
export function readPlacedItems(values: readonly unknown[]): LtiPlacedItem[] {
  return values.flatMap((value) => {
    if (typeof value !== 'string') return [];
    const separator = value.indexOf(':');
    const item = placedItemOf({
      [ltiItemParams.kind]: value.slice(0, separator),
      [ltiItemParams.id]: value.slice(separator + 1),
    });
    return separator < 0 || item === null ? [] : [item];
  });
}

/**
 * Why the picker cannot open: on it, a ticket for someone else means another account is logged in
 * than the one linked to the course system.
 */
export const ltiPlaceProblemFor = (code: LtiErrorCode): LtiProblem =>
  code === 'forbidden' ? 'other_account' : ltiProblemFor(code);

const placeErrors: Partial<Record<LtiErrorCode, MessageKey>> = {
  nothing_chosen: 'lti.placeNothingChosen',
  too_many_items: 'lti.placeTooMany',
  not_placeable: 'lti.placeNotPlaceable',
};

/** The message shown on the picker when adding to the course is refused. */
export const ltiPlaceErrorKey = (code: LtiErrorCode): MessageKey =>
  placeErrors[code] ?? `lti.problem_${ltiPlaceProblemFor(code)}`;

/** What a school's IT team pastes into its course system to add TeacherHubPro. */
export const ltiToolValues = (appUrl: string) => ({
  loginUrl: `${appUrl}/api/lti/login`,
  launchUrl: `${appUrl}/api/lti/launch`,
  jwksUrl: `${appUrl}/api/lti/jwks`,
  domain: new URL(appUrl).host,
});

const courseOption = z.tuple([z.string().min(1), z.string().min(1)]);

/** A teacher's course as one form value: its course system and its id there. */
export const ltiCourseOption = (course: {
  readonly platformId: LtiPlatformId;
  readonly contextId: string;
}): string =>
  Buffer.from(JSON.stringify([course.platformId, course.contextId])).toString('base64url');

/** The course a form value names, or null for anything else. */
export function readLtiCourseOption(
  value: unknown,
): { readonly platformId: LtiPlatformId; readonly contextId: string } | null {
  if (typeof value !== 'string' || value === '') return null;
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = courseOption.safeParse(json);
  if (!parsed.success) return null;
  const [platformId, contextId] = parsed.data;
  return { platformId: platformId as LtiPlatformId, contextId };
}
