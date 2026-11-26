import {
  contentLabels,
  maxGameItems,
  maxOptions,
  minOptions,
  type ContentKind,
  type GameContent,
  type GamePicture,
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

/** The card with this picture, or with none. */
export function setPicture<T extends { readonly picture?: GamePicture }>(
  item: T,
  picture: GamePicture | undefined,
): T {
  if (picture !== undefined) return { ...item, picture };
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'picture')) as T;
}

const labelsOf = <K extends ContentKind>(kind: K, items: readonly ItemOf<K>[]) =>
  contentLabels({ kind, items } as GameContent).map((label) => label.trim().toLocaleLowerCase());

interface Extras {
  readonly picture?: GamePicture;
  readonly standards?: readonly string[];
}

const extrasOf = (item: unknown): Extras => {
  if (typeof item !== 'object' || item === null) return {};
  const { picture, standards } = item as Extras;
  return {
    ...(picture === undefined ? {} : { picture }),
    ...(standards === undefined ? {} : { standards }),
  };
};

/**
 * Cards read back from the text box, with the pictures and standards the cards had before put
 * back on the items whose question (or term, or statement) is unchanged; the text box cannot
 * show them.
 */
export function keepExtras<K extends ContentKind>(
  kind: K,
  before: readonly ItemOf<K>[],
  after: readonly ItemOf<K>[],
): readonly ItemOf<K>[] {
  const old = labelsOf(kind, before);
  const kept = new Map<string, Extras>();
  before.forEach((item, index) => {
    const label = old[index];
    if (label !== undefined) kept.set(label, extrasOf(item));
  });
  const labels = labelsOf(kind, after);
  return after.map((item, index) => {
    const extras = kept.get(labels[index] ?? '');
    return (
      extras === undefined || typeof item !== 'object' ? item : { ...item, ...extras }
    ) as ItemOf<K>;
  });
}

/** A card's codes as its text box shows them. */
export const standardsText = (standards: readonly string[] | undefined): string =>
  (standards ?? []).join(',');

/** The text box's codes, kept as typed (so a comma being typed stays) until the card is sent. */
export const textAsStandards = (text: string): readonly string[] =>
  text === '' ? [] : text.split(',');

const cleanCodes = (codes: readonly string[]): string[] => [
  ...new Set(codes.map((code) => code.trim()).filter((code) => code !== '')),
];

/** The card with these codes added to its own, once each; cards of steps have no codes. */
export function addStandardsToAll<T>(items: readonly T[], codes: readonly string[]): readonly T[] {
  const adding = cleanCodes(codes);
  return items.map((item) => {
    if (typeof item !== 'object' || item === null) return item;
    const own = (item as Extras).standards ?? [];
    return { ...item, standards: cleanCodes([...own, ...adding]) };
  });
}

/** The card as sent: its codes trimmed and once each, and no codes field when it has none. */
function withCleanStandards<T>(item: T): T {
  if (typeof item !== 'object' || item === null || !('standards' in item)) return item;
  const codes = cleanCodes((item as Extras).standards ?? []);
  if (codes.length > 0) return { ...item, standards: codes };
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'standards')) as T;
}

const allBlank = (...texts: readonly string[]) => texts.every((text) => text.trim() === '');

const blanks: { readonly [K in ContentKind]: (item: ItemOf<K>) => boolean } = {
  questions: (item) => !item.picture && allBlank(item.prompt, ...item.options),
  statements: (item) => !item.picture && allBlank(item.statement),
  sentences: (item) => !item.picture && allBlank(item.text, item.answer),
  pairs: (item) => !item.picture && allBlank(item.term, item.definition),
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
  return { kind, items: kept.map((item) => withCleanStandards(tidy(item))) } as GameContent;
}
