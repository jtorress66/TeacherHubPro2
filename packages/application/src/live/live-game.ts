import {
  answerQuestion,
  createGamePlay,
  endSession,
  err,
  isCorrectLiveAnswer,
  liveQuestions,
  nextQuestion,
  ok,
  removePlayer,
  revealAnswer,
  startGame,
  type Game,
  type GameModeRegistry,
  type GamePlayId,
  type LiveAnswer,
  type LivePlayerId,
  type LiveSession,
  type LiveTransitionError,
  type Result,
} from '@thp/domain';
import type {
  Clock,
  GamePlayRepository,
  GameRepository,
  IdGenerator,
  LiveAnswerRepository,
  LivePlayerRepository,
  LiveSessionRepository,
  SeedSource,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import {
  clampDuration,
  roundOf,
  scoreOf,
  type GameRound,
  type RoundResult,
} from '../games/play.ts';
import type { LiveActor } from './live-tickets.ts';

// The commands the realtime server runs for a verified actor. The host (or the server's own
// timer) moves the game along; players only answer.

interface LiveDeps {
  readonly liveSessions: LiveSessionRepository;
  readonly clock: Clock;
}

async function sessionOf(
  deps: LiveDeps,
  actor: LiveActor,
): Promise<Result<LiveSession, UseCaseError>> {
  const session = await deps.liveSessions.findById(actor.schoolId, actor.sessionId);
  return session === null ? fail('not_found') : ok(session);
}

const runsTheGame = (actor: LiveActor): boolean => actor.role === 'host' || actor.role === 'system';

const outOfOrder = (): Result<never, UseCaseError> => err({ field: 'status', code: 'not_allowed' });

type Move = (session: LiveSession, now: Date) => Result<LiveSession, LiveTransitionError>;

/** A host move on the session: checked, applied and saved. */
async function hostMove(
  deps: LiveDeps,
  actor: LiveActor,
  move: Move,
): Promise<Result<LiveSession, UseCaseError>> {
  if (!runsTheGame(actor)) return fail('forbidden');
  const session = await sessionOf(deps, actor);
  if (!session.ok) return session;
  const moved = move(session.value, deps.clock.now());
  if (!moved.ok) return outOfOrder();
  await deps.liveSessions.save(moved.value);
  return moved;
}

export class StartLiveGame {
  constructor(private readonly deps: LiveDeps) {}

  execute(input: { readonly actor: LiveActor }): Promise<Result<LiveSession, UseCaseError>> {
    return hostMove(this.deps, input.actor, startGame);
  }
}

export class NextLiveQuestion {
  constructor(private readonly deps: LiveDeps) {}

  execute(input: { readonly actor: LiveActor }): Promise<Result<LiveSession, UseCaseError>> {
    return hostMove(this.deps, input.actor, nextQuestion);
  }
}

export class EndLiveSession {
  constructor(private readonly deps: LiveDeps) {}

  execute(input: { readonly actor: LiveActor }): Promise<Result<LiveSession, UseCaseError>> {
    return hostMove(this.deps, input.actor, endSession);
  }
}

/**
 * Shows the answer to the question on screen. The timer passes the question it was set for, so
 * a timer that fires after the host has moved on changes nothing.
 */
export class RevealLiveAnswer {
  constructor(private readonly deps: LiveDeps) {}

  async execute(input: {
    readonly actor: LiveActor;
    readonly question?: number;
  }): Promise<Result<LiveSession, UseCaseError>> {
    if (!runsTheGame(input.actor)) return fail('forbidden');
    const session = await sessionOf(this.deps, input.actor);
    if (!session.ok) return session;
    const { status, current } = session.value;
    if (input.question !== undefined && (status !== 'question' || current !== input.question)) {
      return session;
    }
    return hostMove(this.deps, input.actor, revealAnswer);
  }
}

export class RemoveLivePlayer {
  constructor(private readonly deps: LiveDeps & { readonly livePlayers: LivePlayerRepository }) {}

  async execute(input: {
    readonly actor: LiveActor;
    readonly playerId: LivePlayerId;
  }): Promise<Result<true, UseCaseError>> {
    if (!runsTheGame(input.actor)) return fail('forbidden');
    const player = await this.deps.livePlayers.findById(input.actor.schoolId, input.playerId);
    if (player?.sessionId !== input.actor.sessionId) return fail('not_found');
    await this.deps.livePlayers.save(removePlayer(player, this.deps.clock.now()));
    return ok(true);
  }
}

interface PlayDeps extends LiveDeps {
  readonly livePlayers: LivePlayerRepository;
  readonly liveAnswers: LiveAnswerRepository;
  readonly games: GameRepository;
  readonly gameModes: GameModeRegistry;
}

async function gameOf(deps: PlayDeps, session: LiveSession): Promise<Result<Game, UseCaseError>> {
  const game = await deps.games.findById(session.schoolId, session.gameId);
  return game === null ? fail('not_found') : ok(game);
}

export interface SubmittedAnswer {
  readonly answer: LiveAnswer;
  /** True when this was the last answer and the question was revealed at once. */
  readonly revealed: boolean;
}

/** A player's answer, timed and scored on the server; the last one in reveals the question. */
export class SubmitLiveAnswer {
  constructor(private readonly deps: PlayDeps) {}

  async execute(input: {
    readonly actor: LiveActor;
    readonly question: number;
    readonly choice: number;
  }): Promise<Result<SubmittedAnswer, UseCaseError>> {
    const { actor } = input;
    if (actor.role !== 'player') return fail('forbidden');
    const session = await sessionOf(this.deps, actor);
    if (!session.ok) return session;
    const game = await gameOf(this.deps, session.value);
    if (!game.ok) return game;
    const player = await this.deps.livePlayers.findById(actor.schoolId, actor.playerId);
    if (player === null) return fail('unauthenticated');
    const { seed, mode } = session.value;
    const modes = this.deps.gameModes;
    const all = await this.deps.liveAnswers.listBySessions(actor.schoolId, [session.value.id]);
    const answer = answerQuestion({
      session: session.value,
      player,
      previous: all.filter((a) => a.playerId === player.id),
      question: input.question,
      prompt: liveQuestions(game.value, mode, seed, modes)?.[input.question]?.prompt ?? '',
      choice: input.choice,
      correct: isCorrectLiveAnswer(game.value, mode, seed, input.question, input.choice, modes),
      now: this.deps.clock.now(),
    });
    if (!answer.ok) return answer;
    try {
      await this.deps.liveAnswers.save(answer.value);
    } catch {
      return err({ field: 'answer', code: 'duplicate' });
    }
    const revealed = await this.revealWhenAllAnswered(session.value, [...all, answer.value]);
    return ok({ answer: answer.value, revealed });
  }

  private async revealWhenAllAnswered(
    session: LiveSession,
    answers: readonly LiveAnswer[],
  ): Promise<boolean> {
    const players = await this.deps.livePlayers.listBySessions(session.schoolId, [session.id]);
    const answered = new Set(
      answers.filter((a) => a.question === session.current).map((a) => a.playerId),
    );
    const waiting = players.some((p) => p.removedAt === null && !answered.has(p.id));
    if (waiting) return false;
    const revealed = revealAnswer(session);
    if (!revealed.ok) return false;
    await this.deps.liveSessions.save(revealed.value);
    return true;
  }
}

interface SelfPacedDeps extends PlayDeps {
  readonly seeds: SeedSource;
}

/** A self-paced player's session and game, or why they cannot play now. */
async function selfPaced(deps: PlayDeps, actor: LiveActor) {
  if (actor.role !== 'player') return fail('forbidden');
  const session = await sessionOf(deps, actor);
  if (!session.ok) return session;
  if (session.value.kind !== 'self_paced' || session.value.status !== 'open') return outOfOrder();
  const game = await gameOf(deps, session.value);
  if (!game.ok) return game;
  const player = await deps.livePlayers.findById(actor.schoolId, actor.playerId);
  if (player === null) return fail('unauthenticated');
  return ok({ session: session.value, game: game.value, player });
}

/** A fresh round of the game for a self-paced player; play again is another round. */
export class StartSelfPacedRound {
  constructor(private readonly deps: SelfPacedDeps) {}

  async execute(input: {
    readonly actor: LiveActor;
    readonly mode?: string;
  }): Promise<Result<GameRound, UseCaseError>> {
    const found = await selfPaced(this.deps, input.actor);
    if (!found.ok) return found;
    return roundOf(found.value.game, this.deps.gameModes, input.mode, this.deps.seeds.next());
  }
}

/** Scores a self-paced round on the server and saves it as a play by the roster student. */
export class FinishSelfPacedRound {
  constructor(
    private readonly deps: SelfPacedDeps & {
      readonly gamePlays: GamePlayRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly actor: LiveActor;
    readonly mode: string;
    readonly seed: number;
    readonly answers: unknown;
    readonly durationMs: number;
  }): Promise<Result<RoundResult, UseCaseError>> {
    const found = await selfPaced(this.deps, input.actor);
    if (!found.ok) return found;
    const { session, game, player } = found.value;
    const scored = scoreOf(game, this.deps.gameModes, { ...input, gameId: game.id });
    if (!scored.ok) return scored;
    const play = createGamePlay({
      id: this.deps.ids.next() as GamePlayId,
      schoolId: session.schoolId,
      gameId: game.id,
      classId: session.classId,
      studentId: player.studentId,
      mode: scored.value.mode,
      seed: input.seed,
      score: scored.value.score.score,
      total: scored.value.score.total,
      durationMs: clampDuration(input.durationMs),
      playedAt: this.deps.clock.now(),
    });
    if (!play.ok) return play;
    await this.deps.gamePlays.save(play.value);
    return ok(scored.value.score);
  }
}
