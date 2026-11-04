import {
  endSession,
  isStaleLiveSession,
  joinPlayer,
  ok,
  rosterNames,
  type LivePlayerId,
  type LiveSession,
  type LiveSessionId,
  type Result,
  type StudentId,
} from '@thp/domain';
import type {
  Clock,
  GameRepository,
  IdGenerator,
  LivePlayerRepository,
  LiveSessionRepository,
  RandomTokenGenerator,
  StudentRepository,
  TicketSigner,
  TokenHasher,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { playerTicket, readTicket, type LiveActor } from './live-tickets.ts';

// What a student does without an account: enter the session's PIN, then tap their own name.

interface PinDeps {
  readonly liveSessions: LiveSessionRepository;
  readonly clock: Clock;
}

/** The open session behind a PIN; one left open too long is closed and not found. */
async function openByPin(deps: PinDeps, pin: string): Promise<LiveSession | null> {
  const session = await deps.liveSessions.findOpenByPin(pin.trim());
  if (session === null) return null;
  if (!isStaleLiveSession(session, deps.clock.now())) return session;
  const ended = endSession(session, deps.clock.now());
  if (ended.ok) await deps.liveSessions.save(ended.value);
  return null;
}

export interface LiveLobby {
  readonly sessionId: LiveSessionId;
  readonly title: string;
  /** The class's first names (a last initial where two match), and which are taken. */
  readonly names: readonly {
    readonly studentId: StudentId;
    readonly name: string;
    readonly taken: boolean;
  }[];
}

interface RosterDeps extends PinDeps {
  readonly students: StudentRepository;
  readonly livePlayers: LivePlayerRepository;
}

async function rosterOf(deps: RosterDeps, session: LiveSession) {
  const students = await deps.students.listByClass(session.schoolId, session.classId);
  const players = await deps.livePlayers.listBySessions(session.schoolId, [session.id]);
  const active = players.filter((p) => p.removedAt === null);
  return { names: rosterNames(students), active };
}

export class FindLiveSessionByPin {
  constructor(private readonly deps: RosterDeps & { readonly games: GameRepository }) {}

  async execute(input: { readonly pin: string }): Promise<Result<LiveLobby, UseCaseError>> {
    const session = await openByPin(this.deps, input.pin);
    if (session === null) return fail('not_found');
    const game = await this.deps.games.findById(session.schoolId, session.gameId);
    const { names, active } = await rosterOf(this.deps, session);
    const taken = new Set(active.map((p) => p.studentId));
    return ok({
      sessionId: session.id,
      title: game?.title ?? '',
      names: names.map((n) => ({ ...n, taken: taken.has(n.studentId) })),
    });
  }
}

export interface LiveJoin {
  readonly sessionId: LiveSessionId;
  readonly playerId: LivePlayerId;
  /** Lets this device connect to the realtime server. */
  readonly ticket: string;
  /** Kept by this device to rejoin after a disconnect; only its hash is stored. */
  readonly reconnectToken: string;
}

/** Joins as the tapped student. A taken name opens only for the device holding its token. */
export class JoinLiveSession {
  constructor(
    private readonly deps: RosterDeps & {
      readonly ticketSigner: TicketSigner;
      readonly tokens: RandomTokenGenerator;
      readonly tokenHasher: TokenHasher;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly pin: string;
    readonly studentId: string;
    readonly reconnectToken?: string;
  }): Promise<Result<LiveJoin, UseCaseError>> {
    const session = await openByPin(this.deps, input.pin);
    if (session === null) return fail('not_found');
    const { names, active } = await rosterOf(this.deps, session);
    const name = names.find((n) => n.studentId === input.studentId);
    if (name === undefined) return fail('not_found');
    const now = this.deps.clock.now();
    const existing = active.find((p) => p.studentId === name.studentId);
    if (existing !== undefined) {
      const token = input.reconnectToken ?? '';
      const matches =
        token !== '' && (await this.deps.tokenHasher.hash(token)) === existing.tokenHash;
      if (!matches) return fail('name_taken');
      return ok({
        sessionId: session.id,
        playerId: existing.id,
        ticket: playerTicket(this.deps.ticketSigner, existing, now),
        reconnectToken: token,
      });
    }
    const reconnectToken = this.deps.tokens.generate();
    const player = joinPlayer({
      id: this.deps.ids.next() as LivePlayerId,
      schoolId: session.schoolId,
      sessionId: session.id,
      studentId: name.studentId,
      firstName: name.name,
      tokenHash: await this.deps.tokenHasher.hash(reconnectToken),
      joinedAt: now,
    });
    if (!player.ok) return player;
    await this.deps.livePlayers.save(player.value);
    return ok({
      sessionId: session.id,
      playerId: player.value.id,
      ticket: playerTicket(this.deps.ticketSigner, player.value, now),
      reconnectToken,
    });
  }
}

/** The actor behind a ticket presented to the realtime server; a removed player is turned away. */
export class VerifyLiveTicket {
  constructor(
    private readonly deps: {
      readonly ticketSigner: TicketSigner;
      readonly livePlayers: LivePlayerRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { readonly ticket: string }): Promise<Result<LiveActor, UseCaseError>> {
    const actor = readTicket(this.deps.ticketSigner, input.ticket, this.deps.clock.now());
    if (actor === null) return fail('unauthenticated');
    if (actor.role !== 'player') return ok(actor);
    const player = await this.deps.livePlayers.findById(actor.schoolId, actor.playerId);
    return player?.sessionId === actor.sessionId && player.removedAt === null
      ? ok(actor)
      : fail('unauthenticated');
  }
}
