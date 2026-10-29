import type { GameId, GameModeId, SchoolId, UserId } from '../shared/ids.ts';
import { defaultLanguage, isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

/** A saved educational game. Each mode validates its own items (step 11). */
export interface Game {
  readonly id: GameId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string;
  readonly modeId: GameModeId;
  readonly language: Language;
  readonly items: readonly unknown[];
}

export interface GameInput {
  readonly id: GameId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string;
  readonly modeId: GameModeId;
  readonly items: readonly unknown[];
  readonly language?: string;
}

export function createGame(input: GameInput): Result<Game, ValidationError> {
  const title = requiredText('title', input.title);
  if (!title.ok) return title;
  if (input.items.length === 0) return invalid('items', 'required');
  const language = input.language ?? defaultLanguage;
  if (!isLanguage(language)) return invalid('language', 'invalid_format');

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    title: title.value,
    modeId: input.modeId,
    language,
    items: input.items,
  });
}
