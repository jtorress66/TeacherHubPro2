import type { GameId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, maxShortTextLength, type ValidationError } from '../shared/validation.ts';
import {
  contentLabels,
  maxGameItems,
  type ContentKind,
  type GameContent,
  type ItemOf,
} from './content.ts';
import { convertContent } from './conversions.ts';
import { noGrading, type Game } from './game.ts';
import type { Random } from './random.ts';

/**
 * A copy to reuse: same content, mode and language, shared with no class and not counted as a
 * grade, so nothing about the original's class or gradebook carries over.
 */
export function duplicateGame(
  game: Game,
  copy: { readonly id: GameId; readonly title: string; readonly now: Date },
): Game {
  return {
    ...game,
    id: copy.id,
    title: copy.title.trim().slice(0, maxShortTextLength),
    classId: null,
    grading: noGrading,
    createdAt: copy.now,
    updatedAt: copy.now,
  };
}

export interface AppendedItems {
  readonly content: GameContent;
  readonly added: number;
  /** Repeats of items already in the game, and items past the most a game can have. */
  readonly skipped: number;
}

const sameText = (text: string) => text.trim().toLocaleLowerCase();

/**
 * Another game's items added after this content's, turned into this content's kind when there
 * is a conversion (pairs into quiz questions). The game's own checks still run when it is saved.
 */
export function appendGameItems(
  content: GameContent,
  source: GameContent,
  random: Random,
): Result<AppendedItems, ValidationError> {
  const incoming =
    source.kind === content.kind ? source : convertContent(source, content.kind, random);
  if (incoming === null) return invalid('source', 'not_allowed');
  const seen = new Set(contentLabels(content).map(sameText));
  const labels = contentLabels(incoming);
  const fresh = (incoming.items as readonly ItemOf<ContentKind>[]).filter((_, index) => {
    const label = sameText(labels[index] ?? '');
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (fresh.length === 0) return invalid('source', 'duplicate');
  const room = Math.max(0, maxGameItems - content.items.length);
  const added = fresh.slice(0, room);
  return ok({
    content: { kind: content.kind, items: [...content.items, ...added] } as GameContent,
    added: added.length,
    skipped: incoming.items.length - added.length,
  });
}
