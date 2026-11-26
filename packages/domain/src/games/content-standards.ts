import type { ContentKind, GameContent, ItemOf } from './content.ts';

/** Every standard the game's items practise, once each, in the order they first appear. */
export function standardsOf(content: GameContent): string[] {
  const codes = (content.items as readonly ItemOf<ContentKind>[]).flatMap((item) =>
    typeof item === 'object' ? (item.standards ?? []) : [],
  );
  return [...new Set(codes)];
}
