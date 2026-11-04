import {
  createLiveSession,
  err,
  isAdminOf,
  liveInsights,
  liveKinds,
  liveModes,
  liveQuestions,
  ok,
  pinFromSeed,
  playableModes,
  questionSecondsRange,
  type ClassId,
  type GameId,
  type GameModeRegistry,
  type LiveInsights,
  type LiveKind,
  type LiveSession,
  type LiveSessionId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  GameRepository,
  IdGenerator,
  LiveAnswerRepository,
  LivePlayerRepository,
  LiveSessionRepository,
  SeedSource,
  TicketSigner,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findOwnGame } from '../games/game-access.ts';
import { hostTicket } from './live-tickets.ts';

export interface LiveSessionRef {
  readonly actor: User;
  readonly sessionId: LiveSessionId;
}

/** A session in the actor's school that they run, or that their school's admin may manage. */
export async function findOwnLiveSession(
  sessions: LiveSessionRepository,
  { actor, sessionId }: LiveSessionRef,
): Promise<Result<LiveSession, UseCaseError>> {
  const session = await sessions.findById(actor.schoolId, sessionId);
  if (session === null) return fail('not_found');
  return session.teacherId === actor.id || isAdminOf(actor, session.schoolId)
    ? ok(session)
    : fail('forbidden');
}

const isKind = (value: string): value is LiveKind =>
  (liveKinds as readonly string[]).includes(value);

const pinAttempts = 20;

export interface StartLiveInput {
  readonly actor: User;
  readonly gameId: GameId;
  readonly classId: ClassId;
  readonly kind: string;
  readonly mode?: string;
  readonly questionSeconds?: number;
}

/**
 * Opens a Play to Learn session of one of the teacher's games for a class they manage. Live
 * sessions use the question modes; self-paced ones any mode the game can be played in.
 */
export class StartLiveSession {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly classes: ClassRepository;
      readonly gameModes: GameModeRegistry;
      readonly liveSessions: LiveSessionRepository;
      readonly seeds: SeedSource;
      readonly clock: Clock;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: StartLiveInput): Promise<Result<LiveSession, UseCaseError>> {
    if (!isKind(input.kind)) return err({ field: 'kind', code: 'invalid_format' });
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const modes =
      input.kind === 'live'
        ? liveModes(game.value, this.deps.gameModes)
        : playableModes(game.value, this.deps.gameModes).map((m) => m.id);
    const mode = input.mode === undefined ? modes[0] : modes.find((m) => m === input.mode);
    if (mode === undefined) return err({ field: 'mode', code: 'not_allowed' });
    const seed = this.deps.seeds.next();
    const questionCount =
      input.kind === 'live'
        ? (liveQuestions(game.value, mode, seed, this.deps.gameModes)?.length ?? 0)
        : game.value.content.items.length;
    const pin = await this.freePin();
    if (pin === null) return fail('storage_unavailable');
    const session = createLiveSession({
      id: this.deps.ids.next() as LiveSessionId,
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
      gameId: game.value.id,
      classId: cls.value.id,
      kind: input.kind,
      mode,
      pin,
      seed,
      questionCount,
      questionSeconds: input.questionSeconds ?? questionSecondsRange.default,
      createdAt: this.deps.clock.now(),
    });
    if (!session.ok) return session;
    await this.deps.liveSessions.save(session.value);
    return session;
  }

  /** A PIN no open session is using. */
  private async freePin(): Promise<string | null> {
    for (let attempt = 0; attempt < pinAttempts; attempt += 1) {
      const pin = pinFromSeed(this.deps.seeds.next());
      if ((await this.deps.liveSessions.findOpenByPin(pin)) === null) return pin;
    }
    return null;
  }
}

export class ListLiveSessions {
  constructor(private readonly deps: { readonly liveSessions: LiveSessionRepository }) {}

  execute(input: { readonly actor: User }): Promise<readonly LiveSession[]> {
    return this.deps.liveSessions.listByTeacher(input.actor.schoolId, input.actor.id);
  }
}

export interface LiveHost {
  readonly session: LiveSession;
  readonly title: string;
  /** Lets the host screen connect to the realtime server. */
  readonly ticket: string;
}

/** The host screen's start: the session, its game's title and a fresh host ticket. */
export class OpenLiveHost {
  constructor(
    private readonly deps: {
      readonly liveSessions: LiveSessionRepository;
      readonly games: GameRepository;
      readonly ticketSigner: TicketSigner;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: LiveSessionRef): Promise<Result<LiveHost, UseCaseError>> {
    const session = await findOwnLiveSession(this.deps.liveSessions, input);
    if (!session.ok) return session;
    const game = await this.deps.games.findById(session.value.schoolId, session.value.gameId);
    return ok({
      session: session.value,
      title: game?.title ?? '',
      ticket: hostTicket(
        this.deps.ticketSigner,
        session.value,
        input.actor.id,
        this.deps.clock.now(),
      ),
    });
  }
}

/** Deletes the session with its players and answers. */
export class DeleteLiveSession {
  constructor(
    private readonly deps: {
      readonly liveSessions: LiveSessionRepository;
      readonly livePlayers: LivePlayerRepository;
      readonly liveAnswers: LiveAnswerRepository;
    },
  ) {}

  async execute(input: LiveSessionRef): Promise<Result<true, UseCaseError>> {
    const session = await findOwnLiveSession(this.deps.liveSessions, input);
    if (!session.ok) return session;
    const { schoolId, id } = session.value;
    await this.deps.liveAnswers.deleteBySession(schoolId, id);
    await this.deps.livePlayers.deleteBySession(schoolId, id);
    await this.deps.liveSessions.delete(schoolId, id);
    return ok(true);
  }
}

/** What a game's live sessions show about the class: practice only, never grades. */
export class GetLiveInsights {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly liveSessions: LiveSessionRepository;
      readonly livePlayers: LivePlayerRepository;
      readonly liveAnswers: LiveAnswerRepository;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly gameId: GameId;
  }): Promise<Result<LiveInsights, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    const sessions = await this.deps.liveSessions.listByGame(game.value.schoolId, game.value.id);
    const ids = sessions.map((s) => s.id);
    const players = await this.deps.livePlayers.listBySessions(game.value.schoolId, ids);
    const answers = await this.deps.liveAnswers.listBySessions(game.value.schoolId, ids);
    return ok(liveInsights(sessions.length, players, answers));
  }
}
