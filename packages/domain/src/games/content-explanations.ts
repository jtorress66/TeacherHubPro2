import type { ContentKind, GameContent, ItemOf } from './content.ts';

/** One item the AI is asked to explain: what is asked and the right answer, nothing else. */
export interface UnexplainedItem {
  /** Its place in the game's items. */
  readonly index: number;
  readonly question: string;
  readonly options?: readonly string[];
  /** The right answer ("true" or "false" for a statement). */
  readonly answer: string;
}

type Asked = Omit<UnexplainedItem, 'index'>;

/** How each kind that can be explained is asked about. A new kind is a new entry. */
const askers: { readonly [K in ContentKind]?: (item: ItemOf<K>) => Asked } = {
  questions: (item) => ({
    question: item.prompt,
    options: item.options,
    answer: item.options[item.answer] ?? '',
  }),
  statements: (item) => ({ question: item.statement, answer: item.isTrue ? 'true' : 'false' }),
  sentences: (item) => ({ question: item.text, answer: item.answer }),
};

const hasExplanation = (item: unknown): boolean =>
  typeof item === 'object' &&
  item !== null &&
  'explanation' in item &&
  typeof item.explanation === 'string' &&
  item.explanation.trim() !== '';

/** The items of the game with no explanation yet (none for kinds with nothing to explain). */
export function unexplainedItems(content: GameContent): UnexplainedItem[] {
  const ask = askers[content.kind] as ((item: unknown) => Asked) | undefined;
  if (ask === undefined) return [];
  return (content.items as readonly unknown[]).flatMap((item, index) =>
    hasExplanation(item) ? [] : [{ index, ...ask(item) }],
  );
}

/** The content with drafted explanations put on the items that had none; others are untouched. */
export function withExplanations(
  content: GameContent,
  drafted: ReadonlyMap<number, string>,
): GameContent {
  const items = (content.items as readonly unknown[]).map((item, index) => {
    const explanation = drafted.get(index);
    return explanation === undefined || typeof item !== 'object' || hasExplanation(item)
      ? item
      : { ...item, explanation };
  });
  return { ...content, items } as GameContent;
}
