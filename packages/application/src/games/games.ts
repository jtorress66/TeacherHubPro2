import {
  createGame,
  ok,
  playableModes,
  updateGame,
  type ClassId,
  type Game,
  type GameChanges,
  type GameContent,
  type GameId,
  type GameModeId,
  type GameModeRegistry,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  GamePlayRepository,
  GameRepository,
  IdGenerator,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';
import { findOwnGame, type GameRef } from './game-access.ts';

interface GameDeps {
  readonly games: GameRepository;
  readonly classes: ClassRepository;
  readonly gameModes: GameModeRegistry;
  readonly clock: Clock;
}

/** A class to share the game with must be one the actor manages. */
async function checkClass(
  deps: GameDeps,
  actor: User,
  classId: ClassId | null | undefined,
): Promise<Result<true, UseCaseError>> {
  if (classId === null || classId === undefined) return ok(true);
  const cls = await findManagedClass(deps.classes, actor, classId);
  return cls.ok ? ok(true) : cls;
}

export interface CreateGameInput {
  readonly actor: User;
  readonly title: string;
  readonly mode: string;
  readonly content: GameContent;
  readonly language?: string;
  readonly classId?: ClassId | null;
}

/** Saves a game the teacher typed or reviewed from an AI draft; in their language by default. */
export class CreateGame {
  constructor(private readonly deps: GameDeps & { readonly ids: IdGenerator }) {}

  async execute(input: CreateGameInput): Promise<Result<Game, UseCaseError>> {
    const cls = await checkClass(this.deps, input.actor, input.classId);
    if (!cls.ok) return cls;
    const game = createGame(
      {
        id: this.deps.ids.next() as GameId,
        schoolId: input.actor.schoolId,
        teacherId: input.actor.id,
        title: input.title,
        mode: input.mode,
        content: input.content,
        language: input.language ?? input.actor.language,
        classId: input.classId ?? null,
        createdAt: this.deps.clock.now(),
      },
      this.deps.gameModes,
    );
    if (!game.ok) return game;
    await this.deps.games.save(game.value);
    return game;
  }
}

export class UpdateGame {
  constructor(private readonly deps: GameDeps) {}

  async execute(
    input: GameRef & { readonly changes: GameChanges },
  ): Promise<Result<Game, UseCaseError>> {
    const found = await findOwnGame(this.deps.games, input);
    if (!found.ok) return found;
    const cls = await checkClass(this.deps, input.actor, input.changes.classId);
    if (!cls.ok) return cls;
    const game = updateGame(found.value, input.changes, this.deps.clock.now(), this.deps.gameModes);
    if (!game.ok) return game;
    await this.deps.games.save(game.value);
    return game;
  }
}

/** The actor's own games, oldest first. */
export class ListGames {
  constructor(private readonly deps: { readonly games: GameRepository }) {}

  execute(input: { readonly actor: User }): Promise<readonly Game[]> {
    return this.deps.games.listByTeacher(input.actor.schoolId, input.actor.id);
  }
}

export interface GameDetails {
  readonly game: Game;
  /** The modes students can play it in. */
  readonly modes: readonly GameModeId[];
}

export class GetGame {
  constructor(private readonly deps: Pick<GameDeps, 'games' | 'gameModes'>) {}

  async execute(input: GameRef): Promise<Result<GameDetails, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    const modes = playableModes(game.value, this.deps.gameModes).map((mode) => mode.id);
    return ok({ game: game.value, modes });
  }
}

/** Deletes the game and its plays; grades already confirmed stay in the gradebook. */
export class DeleteGame {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly gamePlays: GamePlayRepository;
    },
  ) {}

  async execute(input: GameRef): Promise<Result<true, UseCaseError>> {
    const game = await findOwnGame(this.deps.games, input);
    if (!game.ok) return game;
    await this.deps.gamePlays.deleteByGame(game.value.schoolId, game.value.id);
    await this.deps.games.delete(game.value.schoolId, game.value.id);
    return ok(true);
  }
}
