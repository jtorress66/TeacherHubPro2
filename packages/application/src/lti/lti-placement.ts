import {
  deepLinkingResponse,
  err,
  ok,
  type AssignmentId,
  type ClassId,
  type GameId,
  type LtiContentItem,
  type LtiLaunch,
  type LtiPlacedItem,
  type LtiPlatform,
  type LtiPlatformId,
  type Result,
  type SchoolId,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttachmentRepository,
  ClassRepository,
  Clock,
  GameRepository,
  LtiPlatformRepository,
  LtiUserLinkRepository,
  RandomTokenGenerator,
  TicketSigner,
  ToolJwtSigner,
} from '@thp/ports';
import { managedAssignment } from '../assignments/assignment-access.ts';
import { isReady } from '../assignments/student-portal.ts';
import { findOwnGame } from '../games/game-access.ts';
import type { LtiError, LtiErrorCode } from './lti-launch.ts';

// Deep Linking: a teacher adds TeacherHubPro assignments and games to a course from the course
// system's "Add content", and the placed links later open them again.

const refuse = (code: LtiErrorCode) => err<LtiError>({ code });

/** A teacher has this long, after "Add content", to choose what to place. */
export const ltiPlaceTicketLifetimeMs = 30 * 60 * 1000;

const placePurpose = 'lti-place';

/** A course page takes at most this many items at once. */
const maxItems = 50;

/** Where a placed item opens in the app. */
export type LtiItemTarget =
  | {
      readonly kind: 'assignment';
      readonly classId: ClassId;
      readonly assignmentId: AssignmentId;
    }
  | { readonly kind: 'game'; readonly gameId: GameId };

export interface LtiItemDeps {
  readonly classes: ClassRepository;
  readonly assignments: AssignmentRepository;
  readonly games: GameRepository;
}

/**
 * Where a teacher's launch of a placed item lands, when they may see it in the app: an assignment
 * of a class they manage, or a game of theirs (or of their school, for its admin). Null otherwise.
 */
export async function ltiItemTarget(
  deps: LtiItemDeps,
  actor: User,
  item: LtiPlacedItem,
): Promise<LtiItemTarget | null> {
  if (item.kind === 'game') {
    const game = await findOwnGame(deps.games, { actor, gameId: item.id });
    return game.ok ? { kind: 'game', gameId: game.value.id } : null;
  }
  const assignment = await deps.assignments.findById(actor.schoolId, item.id);
  if (assignment === null) return null;
  const ref = { actor, classId: assignment.classId, assignmentId: assignment.id };
  return (await managedAssignment(deps, ref)).ok
    ? { kind: 'assignment', classId: assignment.classId, assignmentId: assignment.id }
    : null;
}

export interface LtiPlaceDeps {
  readonly ltiPlatforms: LtiPlatformRepository;
  readonly ltiUserLinks: LtiUserLinkRepository;
  readonly ticketSigner: TicketSigner;
  readonly clock: Clock;
}

/**
 * A signed ticket for a deep linking request: who asked (the course system's user, so it serves
 * only the account linked to them) and where the chosen items go. It works for a teacher who links
 * their account first, too.
 */
export function issuePlaceTicket(
  deps: Pick<LtiPlaceDeps, 'ticketSigner'>,
  launch: LtiLaunch,
  schoolId: SchoolId,
  now: Date,
): string | null {
  if (launch.deepLinking === null) return null;
  const { returnUrl, acceptMultiple, data } = launch.deepLinking;
  return deps.ticketSigner.sign(
    {
      purpose: placePurpose,
      platformId: launch.platformId,
      schoolId,
      subject: launch.subject,
      deploymentId: launch.deploymentId,
      returnUrl,
      acceptMultiple: String(acceptMultiple),
      ...(data === null ? {} : { data }),
    },
    new Date(now.getTime() + ltiPlaceTicketLifetimeMs),
  );
}

interface PlaceTicket {
  readonly platformId: LtiPlatformId;
  readonly schoolId: SchoolId;
  readonly subject: string;
  readonly deploymentId: string;
  readonly returnUrl: string;
  readonly acceptMultiple: boolean;
  readonly data: string | null;
}

function readPlaceTicket(deps: LtiPlaceDeps, ticket: string): PlaceTicket | null {
  const payload = deps.ticketSigner.verify(ticket, deps.clock.now());
  if (payload?.purpose !== placePurpose) return null;
  const { platformId, schoolId, subject, deploymentId, returnUrl } = payload;
  if (
    platformId === undefined ||
    schoolId === undefined ||
    subject === undefined ||
    deploymentId === undefined ||
    returnUrl === undefined
  ) {
    return null;
  }
  return {
    platformId: platformId as LtiPlatformId,
    schoolId: schoolId as SchoolId,
    subject,
    deploymentId,
    returnUrl,
    acceptMultiple: payload.acceptMultiple === 'true',
    data: payload.data ?? null,
  };
}

/** The ticket's request and course system, for the account linked to the user who asked. */
async function openPlacement(
  deps: LtiPlaceDeps,
  actor: User,
  ticket: string,
): Promise<Result<{ readonly place: PlaceTicket; readonly platform: LtiPlatform }, LtiError>> {
  const place = readPlaceTicket(deps, ticket);
  if (place === null) return refuse('link_expired');
  if (actor.schoolId !== place.schoolId) return refuse('forbidden');
  const platform = await deps.ltiPlatforms.findById(place.schoolId, place.platformId);
  if (platform === null) return refuse('unknown_platform');
  const linked = await deps.ltiUserLinks.findUserId(platform.id, place.subject);
  return linked === actor.id ? ok({ place, platform }) : refuse('forbidden');
}

/** One assignment or game a teacher may place, as the picker lists it. */
export interface PlaceableItem {
  readonly item: LtiPlacedItem;
  readonly title: string;
  /** The assignment's class; null for a game. */
  readonly className: string | null;
}

export interface PlaceableContent {
  readonly platformName: string;
  /** Whether several items may be chosen at once. */
  readonly acceptMultiple: boolean;
  readonly items: readonly PlaceableItem[];
}

export type ListPlaceableContentDeps = LtiPlaceDeps &
  LtiItemDeps & { readonly attachments: AttachmentRepository };

/**
 * What the teacher may place in a course: the assignments of their classes that students can open
 * (with questions or files), then their games.
 */
async function placeableItems(
  deps: ListPlaceableContentDeps,
  actor: User,
): Promise<readonly PlaceableItem[]> {
  const items: PlaceableItem[] = [];
  for (const cls of await deps.classes.listByTeacher(actor.schoolId, actor.id)) {
    for (const assignment of await deps.assignments.listByClass(cls.schoolId, cls.id)) {
      if (!(await isReady(deps, assignment))) continue;
      items.push({
        item: { kind: 'assignment', id: assignment.id },
        title: assignment.title,
        className: cls.name,
      });
    }
  }
  for (const game of await deps.games.listByTeacher(actor.schoolId, actor.id)) {
    items.push({ item: { kind: 'game', id: game.id }, title: game.title, className: null });
  }
  return items;
}

/** The picker: what the teacher who asked may place, and whether several may be chosen. */
export class ListPlaceableContent {
  constructor(private readonly deps: ListPlaceableContentDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly ticket: string;
  }): Promise<Result<PlaceableContent, LtiError>> {
    const opened = await openPlacement(this.deps, input.actor, input.ticket);
    if (!opened.ok) return opened;
    return ok({
      platformName: opened.value.platform.name,
      acceptMultiple: opened.value.place.acceptMultiple,
      items: await placeableItems(this.deps, input.actor),
    });
  }
}

/** The signed answer the browser posts back to the course system. */
export interface LtiPlacement {
  readonly returnUrl: string;
  /** The deep linking response, signed with the tool's key. */
  readonly jwt: string;
}

export type PlaceLtiContentDeps = ListPlaceableContentDeps & {
  readonly tokens: RandomTokenGenerator;
  readonly toolSigner: ToolJwtSigner;
  readonly appUrl: string;
};

const keyOf = (item: LtiPlacedItem) => `${item.kind}:${item.id}`;

/**
 * Answers a deep linking request with the chosen items: at least one, several only when the course
 * system takes several, and each one the picker offered the teacher (ready, and theirs).
 */
export class PlaceLtiContent {
  constructor(private readonly deps: PlaceLtiContentDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly ticket: string;
    readonly items: readonly LtiPlacedItem[];
  }): Promise<Result<LtiPlacement, LtiError>> {
    const { actor } = input;
    const opened = await openPlacement(this.deps, actor, input.ticket);
    if (!opened.ok) return opened;
    const { place, platform } = opened.value;
    const chosen = [...new Map(input.items.map((item) => [keyOf(item), item])).values()];
    if (chosen.length === 0) return refuse('nothing_chosen');
    if (chosen.length > (place.acceptMultiple ? maxItems : 1)) return refuse('too_many_items');
    const offered = new Map(
      (await placeableItems(this.deps, actor)).map((placeable) => [
        keyOf(placeable.item),
        placeable.title,
      ]),
    );
    const content: LtiContentItem[] = [];
    for (const item of chosen) {
      const title = offered.get(keyOf(item));
      if (title === undefined) return refuse('not_placeable');
      content.push({ title, item });
    }
    const claims = deepLinkingResponse({
      platform,
      deploymentId: place.deploymentId,
      data: place.data,
      items: content,
      launchUrl: `${this.deps.appUrl}/api/lti/launch`,
      nonce: this.deps.tokens.generate(),
      now: this.deps.clock.now(),
    });
    return ok({ returnUrl: place.returnUrl, jwt: await this.deps.toolSigner.sign(claims) });
  }
}
