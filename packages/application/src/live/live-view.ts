import {
  isCorrectLiveAnswer,
  liveLeaderboard,
  liveQuestions,
  ok,
  percentOf,
  questionStats,
  standingOf,
  timeLeftMs,
  type Game,
  type GameModeId,
  type GameModeRegistry,
  type LiveAnswer,
  type LiveKind,
  type LivePlayer,
  type LivePlayerId,
  type LiveQuestion,
  type LiveSession,
  type LiveSessionId,
  type LiveStatus,
  type QuestionStats,
  type Result,
} from '@thp/domain';
import type {
  Clock,
  GamePlayRepository,
  GameRepository,
  LiveAnswerRepository,
  LivePlayerRepository,
  LiveSessionRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import type { LiveActor } from './live-tickets.ts';

export interface LiveBoardRow {
  readonly rank: number;
  readonly playerId: LivePlayerId;
  readonly firstName: string;
  readonly score: number;
  readonly correct: number;
  readonly streak: number;
}

/**
 * What one screen shows. Players never get the PIN's owner details, other students' answers or
 * the correct answer before the reveal; everyone sees first names only.
 */
export interface LiveView {
  readonly sessionId: LiveSessionId;
  readonly kind: LiveKind;
  readonly status: LiveStatus;
  readonly title: string;
  readonly mode: GameModeId;
  /** For the host's screen only. */
  readonly pin: string | null;
  readonly current: number;
  readonly questionCount: number;
  readonly questionSeconds: number;
  readonly timeLeftMs: number;
  readonly question: LiveQuestion | null;
  /** How many have answered the question on screen. */
  readonly answered: number;
  readonly players: readonly { readonly id: LivePlayerId; readonly firstName: string }[];
  readonly reveal: { readonly correctChoice: number; readonly stats: QuestionStats } | null;
  readonly leaderboard: readonly LiveBoardRow[];
  /** The player's own standing (players only). */
  readonly you: {
    readonly playerId: LivePlayerId;
    readonly firstName: string;
    readonly rank: number;
    readonly score: number;
    readonly correct: number;
    readonly streak: number;
    readonly answeredCurrent: boolean;
    readonly lastAnswer: { readonly correct: boolean; readonly points: number } | null;
  } | null;
  /** Self-paced sessions, for the host: each player's plays and best score so far. */
  readonly selfPaced:
    | readonly {
        readonly playerId: LivePlayerId;
        readonly firstName: string;
        readonly plays: number;
        readonly bestPercent: number | null;
      }[]
    | null;
}

const leaderboardSize = 10;

interface ViewDeps {
  readonly liveSessions: LiveSessionRepository;
  readonly livePlayers: LivePlayerRepository;
  readonly liveAnswers: LiveAnswerRepository;
  readonly games: GameRepository;
  readonly gamePlays: GamePlayRepository;
  readonly gameModes: GameModeRegistry;
  readonly clock: Clock;
}

function revealOf(
  game: Game,
  session: LiveSession,
  question: LiveQuestion,
  answers: readonly LiveAnswer[],
  modes: GameModeRegistry,
) {
  const correctChoice = question.options.findIndex((_, choice) =>
    isCorrectLiveAnswer(game, session.mode, session.seed, session.current, choice, modes),
  );
  return { correctChoice, stats: questionStats(answers, session.current, question.options.length) };
}

async function selfPacedBoard(
  deps: ViewDeps,
  session: LiveSession,
  players: readonly LivePlayer[],
): Promise<NonNullable<LiveView['selfPaced']>> {
  const plays = (await deps.gamePlays.listByGame(session.schoolId, session.gameId)).filter(
    (play) => play.playedAt.getTime() >= session.createdAt.getTime(),
  );
  return players.map((player) => {
    const own = plays.filter((play) => play.studentId === player.studentId);
    return {
      playerId: player.id,
      firstName: player.firstName,
      plays: own.length,
      bestPercent: own.length === 0 ? null : Math.max(...own.map(percentOf)),
    };
  });
}

/** The session as the actor's screen shows it right now. */
export class GetLiveView {
  constructor(private readonly deps: ViewDeps) {}

  async execute(input: { readonly actor: LiveActor }): Promise<Result<LiveView, UseCaseError>> {
    const { actor } = input;
    const session = await this.deps.liveSessions.findById(actor.schoolId, actor.sessionId);
    if (session === null) return fail('not_found');
    const game = await this.deps.games.findById(session.schoolId, session.gameId);
    if (game === null) return fail('not_found');
    const allPlayers = await this.deps.livePlayers.listBySessions(session.schoolId, [session.id]);
    const players = allPlayers.filter((p) => p.removedAt === null);
    const answers = await this.deps.liveAnswers.listBySessions(session.schoolId, [session.id]);
    const questions = liveQuestions(game, session.mode, session.seed, this.deps.gameModes) ?? [];
    const showsQuestion =
      session.kind === 'live' && session.current >= 0 && session.status !== 'lobby';
    const question = showsQuestion ? (questions[session.current] ?? null) : null;
    const revealed = session.status === 'reveal' || (session.status === 'ended' && showsQuestion);
    const board = liveLeaderboard(players, answers);
    const isHost = actor.role !== 'player';
    const you = actor.role === 'player' ? players.find((p) => p.id === actor.playerId) : undefined;
    const yourAnswers = you === undefined ? [] : answers.filter((a) => a.playerId === you.id);
    const lastAnswer = yourAnswers.find((a) => a.question === session.current) ?? null;
    return ok({
      sessionId: session.id,
      kind: session.kind,
      status: session.status,
      title: game.title,
      mode: session.mode,
      pin: isHost ? session.pin : null,
      current: session.current,
      questionCount: session.questionCount,
      questionSeconds: session.questionSeconds,
      timeLeftMs: timeLeftMs(session, this.deps.clock.now()),
      question,
      answered: new Set(
        answers.filter((a) => a.question === session.current).map((a) => a.playerId),
      ).size,
      players: players.map((p) => ({ id: p.id, firstName: p.firstName })),
      reveal:
        revealed && question !== null
          ? revealOf(game, session, question, answers, this.deps.gameModes)
          : null,
      leaderboard: board.slice(0, leaderboardSize).map((row) => ({
        rank: row.rank,
        playerId: row.playerId,
        firstName: row.firstName,
        score: row.score,
        correct: row.correct,
        streak: row.streak,
      })),
      you:
        you === undefined
          ? null
          : {
              playerId: you.id,
              firstName: you.firstName,
              rank: board.find((row) => row.playerId === you.id)?.rank ?? board.length,
              ...pick(standingOf(you.id, answers)),
              answeredCurrent: lastAnswer !== null,
              lastAnswer:
                lastAnswer === null || !revealed
                  ? null
                  : { correct: lastAnswer.correct, points: lastAnswer.points },
            },
      selfPaced:
        isHost && session.kind === 'self_paced'
          ? await selfPacedBoard(this.deps, session, players)
          : null,
    });
  }
}

const pick = (standing: ReturnType<typeof standingOf>) => ({
  score: standing.score,
  correct: standing.correct,
  streak: standing.streak,
});
