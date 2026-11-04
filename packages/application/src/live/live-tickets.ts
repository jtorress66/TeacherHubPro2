import type {
  LivePlayer,
  LivePlayerId,
  LiveSession,
  LiveSessionId,
  SchoolId,
  UserId,
} from '@thp/domain';
import type { TicketSigner } from '@thp/ports';

/**
 * Who is acting in a live session, known only from a verified ticket (never from what a browser
 * says). `system` is the realtime server's own timer.
 */
export type LiveActor =
  | {
      readonly role: 'host';
      readonly schoolId: SchoolId;
      readonly sessionId: LiveSessionId;
      readonly userId: UserId;
    }
  | {
      readonly role: 'player';
      readonly schoolId: SchoolId;
      readonly sessionId: LiveSessionId;
      readonly playerId: LivePlayerId;
    }
  | { readonly role: 'system'; readonly schoolId: SchoolId; readonly sessionId: LiveSessionId };

/** Long enough for a lesson; a new one is issued each time the page opens. */
export const liveTicketLifetimeMs = 4 * 60 * 60 * 1000;

const expiry = (now: Date) => new Date(now.getTime() + liveTicketLifetimeMs);

export const hostTicket = (
  signer: TicketSigner,
  session: LiveSession,
  userId: UserId,
  now: Date,
): string =>
  signer.sign(
    { role: 'host', schoolId: session.schoolId, sessionId: session.id, userId },
    expiry(now),
  );

export const playerTicket = (signer: TicketSigner, player: LivePlayer, now: Date): string =>
  signer.sign(
    {
      role: 'player',
      schoolId: player.schoolId,
      sessionId: player.sessionId,
      playerId: player.id,
    },
    expiry(now),
  );

/** The actor behind a genuine ticket, or null. */
export function readTicket(signer: TicketSigner, ticket: string, now: Date): LiveActor | null {
  const payload = signer.verify(ticket, now);
  if (payload === null) return null;
  const { role, schoolId, sessionId, userId, playerId } = payload;
  if (schoolId === undefined || sessionId === undefined) return null;
  const scope = { schoolId: schoolId as SchoolId, sessionId: sessionId as LiveSessionId };
  if (role === 'host' && userId !== undefined) {
    return { role, ...scope, userId: userId as UserId };
  }
  if (role === 'player' && playerId !== undefined) {
    return { role, ...scope, playerId: playerId as LivePlayerId };
  }
  return null;
}
