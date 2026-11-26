import type { ContentKind, GameContent, ItemOf } from './content.ts';
import type { GamePicture } from './game-picture.ts';

type AnyItem = ItemOf<ContentKind>;

const pictureOf = (item: AnyItem): GamePicture | undefined =>
  typeof item === 'object' && 'picture' in item ? item.picture : undefined;

/** Every picture in the game's items, in order. */
export const picturesOf = (content: GameContent): GamePicture[] =>
  (content.items as readonly AnyItem[]).flatMap((item) => {
    const picture = pictureOf(item);
    return picture === undefined ? [] : [picture];
  });

/** The same content with each picture pointing at the id `rename` gives (for a copy's files). */
export function withPictureIds(content: GameContent, rename: (id: string) => string): GameContent {
  const items = (content.items as readonly AnyItem[]).map((item) => {
    const picture = pictureOf(item);
    return picture === undefined || typeof item !== 'object'
      ? item
      : { ...item, picture: { ...picture, id: rename(picture.id) } };
  });
  return { kind: content.kind, items } as GameContent;
}

/** The ids of pictures in `before` that `after` no longer has. */
export function removedPictures(before: GameContent, after: GameContent): string[] {
  const kept = new Set(picturesOf(after).map((p) => p.id));
  return picturesOf(before)
    .map((p) => p.id)
    .filter((id) => !kept.has(id));
}
