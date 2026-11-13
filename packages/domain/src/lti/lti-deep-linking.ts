import type { AssignmentId, GameId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import { ltiClaim, ltiMessageType } from './lti-claims.ts';
import { isSecureAddress, type LtiPlatform } from './lti-platform.ts';

/**
 * An assignment or game a teacher placed in a course: its link carries this reference back to
 * TeacherHubPro in its custom parameters.
 */
export type LtiPlacedItem =
  | { readonly kind: 'assignment'; readonly id: AssignmentId }
  | { readonly kind: 'game'; readonly id: GameId };

/** The custom parameter names a placed item's link carries. */
export const ltiItemParams = { kind: 'thp_kind', id: 'thp_id' } as const;

/** Ids are letters, digits, dashes and underscores; anything else (a substitution) is not ours. */
const itemId = /^[\w-]{1,100}$/u;

type Claims = Readonly<Record<string, unknown>>;

const isClaims = (value: unknown): value is Claims =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The item a launched link's custom parameters name; null for any other link. */
export function placedItemOf(custom: unknown): LtiPlacedItem | null {
  if (!isClaims(custom)) return null;
  const kind = custom[ltiItemParams.kind];
  const id = custom[ltiItemParams.id];
  if (typeof id !== 'string' || !itemId.test(id)) return null;
  if (kind === 'assignment') return { kind, id: id as AssignmentId };
  return kind === 'game' ? { kind, id: id as GameId } : null;
}

/** What a course system's deep linking request asks for. */
export interface LtiDeepLinkingSettings {
  /** Where the browser posts the chosen items back to. */
  readonly returnUrl: string;
  /** Whether several items may be chosen at once (one only, unless the course system says so). */
  readonly acceptMultiple: boolean;
  /** The course system's own value, handed back unchanged; null when it sent none. */
  readonly data: string | null;
}

export type LtiDeepLinkingErrorCode = 'invalid_return_url' | 'links_not_accepted';

/** The deep linking settings of a request: a safe return address, and links to a tool accepted. */
export function readDeepLinkingSettings(
  value: unknown,
): Result<LtiDeepLinkingSettings, LtiDeepLinkingErrorCode> {
  const returnUrl = isClaims(value) ? value.deep_link_return_url : undefined;
  if (typeof returnUrl !== 'string' || !isSecureAddress(returnUrl)) {
    return err('invalid_return_url');
  }
  const settings = value as Claims;
  const types = settings.accept_types;
  if (!Array.isArray(types) || !types.includes('ltiResourceLink')) {
    return err('links_not_accepted');
  }
  return ok({
    returnUrl,
    acceptMultiple: settings.accept_multiple === true,
    data: typeof settings.data === 'string' ? settings.data : null,
  });
}

/** One chosen item and the title its link shows in the course. */
export interface LtiContentItem {
  readonly title: string;
  readonly item: LtiPlacedItem;
}

export interface DeepLinkingResponseInput {
  readonly platform: Pick<LtiPlatform, 'issuer' | 'clientId'>;
  /** The deployment the request came from. */
  readonly deploymentId: string;
  /** The request's data, handed back unchanged. */
  readonly data: string | null;
  readonly items: readonly LtiContentItem[];
  /** Where each placed link launches: TeacherHubPro's launch address. */
  readonly launchUrl: string;
  readonly nonce: string;
  readonly now: Date;
}

/** A deep linking response is good for five minutes. */
const responseLifetimeSeconds = 300;

/**
 * The claims of the signed answer to a deep linking request: from the tool (its client ID) to the
 * course system, each chosen item as a link to TeacherHubPro's launch that opens in a new tab and
 * names the item in its custom parameters.
 */
export function deepLinkingResponse(input: DeepLinkingResponseInput): Record<string, unknown> {
  const seconds = Math.floor(input.now.getTime() / 1000);
  return {
    iss: input.platform.clientId,
    aud: input.platform.issuer,
    iat: seconds,
    exp: seconds + responseLifetimeSeconds,
    nonce: input.nonce,
    [ltiClaim.messageType]: ltiMessageType.deepLinkingResponse,
    [ltiClaim.version]: '1.3.0',
    [ltiClaim.deploymentId]: input.deploymentId,
    [ltiClaim.contentItems]: input.items.map(({ title, item }) => ({
      type: 'ltiResourceLink',
      title,
      url: input.launchUrl,
      custom: { [ltiItemParams.kind]: item.kind, [ltiItemParams.id]: item.id },
      window: { targetName: '_blank' },
    })),
    ...(input.data === null ? {} : { [ltiClaim.deepLinkingData]: input.data }),
  };
}
