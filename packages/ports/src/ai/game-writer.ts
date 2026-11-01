import type { GameContent, GameRequest, Result } from '@thp/domain';
import type { DraftError } from './lesson-plan-drafter.ts';

/** Writes game content for the teacher to review and edit; it never saves anything. */
export interface GameWriter {
  write(request: GameRequest): Promise<Result<GameContent, DraftError>>;
}
