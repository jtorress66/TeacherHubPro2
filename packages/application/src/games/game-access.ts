import { isAdminOf, ok, type Game, type GameId, type Result, type User } from '@thp/domain';
import type { GameRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';

export interface GameRef {
  readonly actor: User;
  readonly gameId: GameId;
}

/** A game in the actor's school that they made, or that their school's admin may manage. */
export async function findOwnGame(
  games: GameRepository,
  { actor, gameId }: GameRef,
): Promise<Result<Game, UseCaseError>> {
  const game = await games.findById(actor.schoolId, gameId);
  if (game === null) return fail('not_found');
  return game.teacherId === actor.id || isAdminOf(actor, game.schoolId)
    ? ok(game)
    : fail('forbidden');
}
