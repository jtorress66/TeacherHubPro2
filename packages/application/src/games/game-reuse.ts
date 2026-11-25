import {
  appendGameItems,
  duplicateGame,
  ok,
  seededRandom,
  updateGame,
  type Game,
  type GameId,
  type GameModeRegistry,
  type Result,
} from '@thp/domain';
import type { Clock, GameRepository, IdGenerator, SeedSource } from '@thp/ports';
import type { UseCaseError } from '../errors.ts';
import { findOwnGame, type GameRef } from './game-access.ts';

/** A reusable copy of the actor's game: not shared with a class and not counted as a grade. */
export class DuplicateGame {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly ids: IdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: GameRef & { readonly title: string }): Promise<Result<Game, UseCaseError>> {
    const found = await findOwnGame(this.deps.games, input);
    if (!found.ok) return found;
    const copy = duplicateGame(found.value, {
      id: this.deps.ids.next() as GameId,
      title: input.title,
      now: this.deps.clock.now(),
    });
    await this.deps.games.save(copy);
    return ok(copy);
  }
}

export interface ItemsAdded {
  readonly game: Game;
  readonly added: number;
  readonly skipped: number;
}

/** Adds the items of another of the actor's games to this one (pairs become quiz questions). */
export class AddItemsFromGame {
  constructor(
    private readonly deps: {
      readonly games: GameRepository;
      readonly gameModes: GameModeRegistry;
      readonly seeds: SeedSource;
      readonly clock: Clock;
    },
  ) {}

  async execute(
    input: GameRef & { readonly sourceId: GameId },
  ): Promise<Result<ItemsAdded, UseCaseError>> {
    const target = await findOwnGame(this.deps.games, input);
    if (!target.ok) return target;
    const source = await findOwnGame(this.deps.games, { ...input, gameId: input.sourceId });
    if (!source.ok) return source;
    const appended = appendGameItems(
      target.value.content,
      source.value.content,
      seededRandom(this.deps.seeds.next()),
    );
    if (!appended.ok) return appended;
    const game = updateGame(
      target.value,
      { content: appended.value.content },
      this.deps.clock.now(),
      this.deps.gameModes,
    );
    if (!game.ok) return game;
    await this.deps.games.save(game.value);
    return ok({ game: game.value, added: appended.value.added, skipped: appended.value.skipped });
  }
}
