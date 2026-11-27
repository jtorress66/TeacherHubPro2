import {
  createGamePlay,
  err,
  ok,
  percentOf,
  roundReview,
  showsAnswersAfterPlay,
  playableModes,
  type Game,
  type GameId,
  type GameMode,
  type GameModeId,
  type GameModeRegistry,
  type GamePlayId,
  type Result,
  type RoundReviewItem,
  type RoundScore,
  type RoundView,
} from '@thp/domain';
import type { GamePlayRepository, GameRepository, IdGenerator, SeedSource } from '@thp/ports';
import {
  mayOpen,
  openStudent,
  type Holder,
  type LinkDeps,
  type StudentKey,
} from '../assignments/student-portal.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findOwnGame, type GameRef } from './game-access.ts';

/** A round to play: what the player sees, never the answers. */
export interface GameRound {
  readonly gameId: GameId;
  readonly title: string;
  readonly language: Game['language'];
  readonly mode: GameModeId;
  /** Every mode the player may switch to. */
  readonly modes: readonly GameModeId[];
  /** Sent back with the answers, so the server rebuilds and scores the same round. */
  readonly seed: number;
  readonly view: RoundView;
}

export interface RoundResult extends RoundScore {
  readonly percent: number;
  /** The missed items; their answers are hidden when replaying could raise a grade. */
  readonly review: readonly RoundReviewItem[];
}

const maxSeed = 2 ** 31;
const maxDurationMs = 2 * 60 * 60 * 1000;

function modeFor(
  game: Game,
  modes: GameModeRegistry,
  requested: string | undefined,
): Result<{ mode: GameMode<RoundView>; all: readonly GameMode<RoundView>[] }, UseCaseError> {
  const all = playableModes(game, modes);
  const mode = requested === undefined ? all[0] : all.find((m) => m.id === requested);
  return mode === undefined ? err({ field: 'mode', code: 'not_allowed' }) : ok({ mode, all });
}

/** A round of the game in the requested mode (or its first playable one) from a seed. */
export function roundOf(
  game: Game,
  modes: GameModeRegistry,
  requested: string | undefined,
  seed: number,
): Result<GameRound, UseCaseError> {
  const found = modeFor(game, modes, requested);
  if (!found.ok) return found;
  const { mode, all } = found.value;
  return ok({
    gameId: game.id,
    title: game.title,
    language: game.language,
    mode: mode.id,
    modes: all.map((m) => m.id),
    seed,
    view: mode.prepare(game.content, seed),
  });
}

export interface FinishInput {
  readonly gameId: GameId;
  readonly mode: string;
  readonly seed: number;
  /** As the mode's player sends them; scored by the mode's own rules. */
  readonly answers: unknown;
}

/**
 * Scores answers to the round the seed rebuilds, by the mode's own rules, with the review of the
 * missed items (answers shown as the game's grading allows, unless `showAnswers` says otherwise).
 */
export function scoreOf(
  game: Game,
  modes: GameModeRegistry,
  input: FinishInput,
  showAnswers = showsAnswersAfterPlay(game.grading),
): Result<{ mode: GameModeId; score: RoundResult }, UseCaseError> {
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed >= maxSeed) {
    return err({ field: 'seed', code: 'out_of_range' });
  }
  const found = modeFor(game, modes, input.mode);
  if (!found.ok) return found;
  const { mode } = found.value;
  const score = mode.score(game.content, input.seed, input.answers);
  const review = roundReview(mode.review(game.content, input.seed, input.answers), showAnswers);
  return ok({ mode: mode.id, score: { ...score, percent: percentOf(score), review } });
}

export const clampDuration = (ms: number): number =>
  Number.isFinite(ms) ? Math.min(maxDurationMs, Math.max(0, Math.round(ms))) : 0;

export interface StudentGameDeps extends LinkDeps {
  readonly games: GameRepository;
  readonly gameModes: GameModeRegistry;
}

/** A game shared with the student's class (the pass's game, for a pass); else not found. */
export async function linkGame(
  deps: StudentGameDeps,
  key: StudentKey,
  gameId: GameId,
): Promise<Result<{ holder: Holder; game: Game }, UseCaseError>> {
  const holder = await openStudent(deps, key);
  if (!holder.ok) return holder;
  if (!mayOpen(holder.value, { kind: 'game', id: gameId })) return fail('not_found');
  const { student } = holder.value;
  const game = await deps.games.findById(student.schoolId, gameId);
  if (game?.classId !== student.classId) return fail('not_found');
  return ok({ holder: holder.value, game });
}

/** A fresh round for a student: play again is just another round, free. */
export class StartGameRound {
  constructor(private readonly deps: StudentGameDeps & { readonly seeds: SeedSource }) {}

  async execute(
    input: StudentKey & { readonly gameId: GameId; readonly mode?: string },
  ): Promise<Result<GameRound, UseCaseError>> {
    const found = await linkGame(this.deps, input, input.gameId);
    if (!found.ok) return found;
    return roundOf(found.value.game, this.deps.gameModes, input.mode, this.deps.seeds.next());
  }
}

/** Scores the student's answers on the server and saves the play, tied to the link's student. */
export class FinishGameRound {
  constructor(
    private readonly deps: StudentGameDeps & {
      readonly gamePlays: GamePlayRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(
    input: FinishInput & StudentKey & { readonly durationMs: number },
  ): Promise<Result<RoundResult, UseCaseError>> {
    const found = await linkGame(this.deps, input, input.gameId);
    if (!found.ok) return found;
    const { holder, game } = found.value;
    const scored = scoreOf(game, this.deps.gameModes, input);
    if (!scored.ok) return scored;
    const play = createGamePlay({
      id: this.deps.ids.next() as GamePlayId,
      schoolId: game.schoolId,
      gameId: game.id,
      classId: holder.student.classId,
      studentId: holder.student.id,
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

interface PreviewDeps {
  readonly games: GameRepository;
  readonly gameModes: GameModeRegistry;
}

/** The teacher plays their own game; previews are never saved. */
export class StartPreviewRound {
  constructor(private readonly deps: PreviewDeps & { readonly seeds: SeedSource }) {}

  async execute(
    input: GameRef & { readonly mode?: string },
  ): Promise<Result<GameRound, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    return roundOf(game.value, this.deps.gameModes, input.mode, this.deps.seeds.next());
  }
}

export class FinishPreviewRound {
  constructor(private readonly deps: PreviewDeps) {}

  async execute(input: GameRef & FinishInput): Promise<Result<RoundResult, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    // The teacher's own preview always shows the answers.
    const scored = scoreOf(game.value, this.deps.gameModes, input, true);
    return scored.ok ? ok(scored.value.score) : scored;
  }
}
