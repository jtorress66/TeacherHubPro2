import {
  maxGameItems,
  maxOptions,
  minOptions,
  type ContentKind,
  type GameContent,
  type GroupItem,
  type ItemOf,
  type PairItem,
  type QuestionItem,
  type SentenceItem,
  type StatementItem,
} from '@thp/domain';
import { contentText, parseContentText } from './game-text.ts';

// The question builder's state: a game's items being edited, one card each. Pure, so the
// component only renders and calls these. The domain still checks everything when it is saved.

export type BuilderItems = { readonly [K in ContentKind]: readonly ItemOf<K>[] };

export const noBuilderItems: BuilderItems = {
  questions: [],
  statements: [],
  sentences: [],
  pairs: [],
  steps: [],
  groups: [],
};

const empties: { readonly [K in ContentKind]: () => ItemOf<K> } = {
  questions: (): QuestionItem => ({ prompt: '', options: ['', ''], answer: 0 }),
  statements: (): StatementItem => ({ statement: '', isTrue: true }),
  sentences: (): SentenceItem => ({ text: '', answer: '' }),
  pairs: (): PairItem => ({ term: '', definition: '' }),
  steps: () => '',
  groups: (): GroupItem => ({ name: '', members: ['', ''] }),
};

export const emptyItem = <K extends ContentKind>(kind: K): ItemOf<K> => empties[kind]();

/** A builder holding this content's items under its kind. */
export const builderItemsOf = (content: GameContent | null): BuilderItems =>
  content === null ? noBuilderItems : { ...noBuilderItems, [content.kind]: content.items };

/** Starts a kind with one empty card, so a new game shows where to type. */
export const withStartingCard = (items: BuilderItems, kind: ContentKind): BuilderItems =>
  items[kind].length > 0 ? items : { ...items, [kind]: [emptyItem(kind)] };

export function addItem<K extends ContentKind>(
  items: readonly ItemOf<K>[],
  kind: K,
): readonly ItemOf<K>[] {
  return items.length >= maxGameItems ? items : [...items, emptyItem(kind)];
}

export const removeItem = <T>(items: readonly T[], index: number): readonly T[] =>
  items.filter((_, i) => i !== index);

/** Moves an item up (-1) or down (+1); does nothing at either end. */
export function moveItem<T>(items: readonly T[], index: number, by: -1 | 1): readonly T[] {
  const to = index + by;
  if (to < 0 || to >= items.length) return items;
  const moved = [...items];
  [moved[index], moved[to]] = [moved[to] as T, moved[index] as T];
  return moved;
}

export const replaceItem = <T>(items: readonly T[], index: number, item: T): readonly T[] =>
  items.map((current, i) => (i === index ? item : current));

/** A question with one more empty answer choice (up to the most allowed). */
export const addOption = (item: QuestionItem): QuestionItem =>
  item.options.length >= maxOptions ? item : { ...item, options: [...item.options, ''] };

/** A question without one answer choice; the right answer stays on the same choice. */
export function removeOption(item: QuestionItem, index: number): QuestionItem {
  if (item.options.length <= minOptions) return item;
  const options = item.options.filter((_, i) => i !== index);
  const answer = index === item.answer ? 0 : index < item.answer ? item.answer - 1 : item.answer;
  return { ...item, options, answer };
}

/** A group with one more empty member, or without one (keeping at least two). */
export const addMember = (item: GroupItem): GroupItem => ({
  ...item,
  members: [...item.members, ''],
});
export const removeMember = (item: GroupItem, index: number): GroupItem =>
  item.members.length <= 2 ? item : { ...item, members: removeItem(item.members, index) };

/** The cards as the "Edit as text" box shows them (blank cards left out). */
export const itemsAsText = <K extends ContentKind>(kind: K, items: readonly ItemOf<K>[]): string =>
  contentText({ kind, items: items.filter((item) => !isBlank(kind, item)) } as GameContent);

/** The "Edit as text" box read back into cards. */
export const textAsItems = <K extends ContentKind>(kind: K, text: string): readonly ItemOf<K>[] =>
  parseContentText(kind, text).items as readonly ItemOf<K>[];

const allBlank = (...texts: readonly string[]) => texts.every((text) => text.trim() === '');

const blanks: { readonly [K in ContentKind]: (item: ItemOf<K>) => boolean } = {
  questions: (item) => allBlank(item.prompt, ...item.options),
  statements: (item) => allBlank(item.statement),
  sentences: (item) => allBlank(item.text, item.answer),
  pairs: (item) => allBlank(item.term, item.definition),
  steps: (item) => allBlank(item),
  groups: (item) => allBlank(item.name, ...item.members),
};

/** A card the teacher left completely empty. */
export const isBlank = <K extends ContentKind>(kind: K, item: ItemOf<K>): boolean =>
  (blanks[kind] as (item: ItemOf<K>) => boolean)(item);

const tidies: { readonly [K in ContentKind]: (item: ItemOf<K>) => ItemOf<K> } = {
  questions: (item) => item,
  statements: (item) => item,
  sentences: (item) => item,
  pairs: (item) => item,
  steps: (item) => item,
  groups: (item) => ({ ...item, members: item.members.filter((m) => m.trim() !== '') }),
};

/**
 * What the builder sends: this kind's cards without the empty ones, and a group's empty member
 * boxes dropped. A half-filled card is sent as it is, so the domain reports what is missing.
 */
export function builderContent<K extends ContentKind>(
  kind: K,
  items: readonly ItemOf<K>[],
): GameContent {
  const tidy = tidies[kind] as (item: ItemOf<K>) => ItemOf<K>;
  const kept = items.filter((item) => !isBlank(kind, item));
  return { kind, items: kept.map(tidy) } as GameContent;
}
