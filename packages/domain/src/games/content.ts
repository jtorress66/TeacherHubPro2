import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

export interface QuestionItem {
  readonly prompt: string;
  readonly options: readonly string[];
  /** The index of the correct option. */
  readonly answer: number;
}

export interface StatementItem {
  readonly statement: string;
  readonly isTrue: boolean;
}

/** A sentence with one `___` blank for the answer. */
export interface SentenceItem {
  readonly text: string;
  readonly answer: string;
}

export interface PairItem {
  readonly term: string;
  readonly definition: string;
}

export interface GroupItem {
  readonly name: string;
  readonly members: readonly string[];
}

/** What a game is made of. Each game mode plays one kind. */
export type GameContent =
  | { readonly kind: 'questions'; readonly items: readonly QuestionItem[] }
  | { readonly kind: 'statements'; readonly items: readonly StatementItem[] }
  | { readonly kind: 'sentences'; readonly items: readonly SentenceItem[] }
  | { readonly kind: 'pairs'; readonly items: readonly PairItem[] }
  | { readonly kind: 'steps'; readonly items: readonly string[] }
  | { readonly kind: 'groups'; readonly items: readonly GroupItem[] };

export type ContentKind = GameContent['kind'];

export const contentKinds = [
  'questions',
  'statements',
  'sentences',
  'pairs',
  'steps',
  'groups',
] as const satisfies readonly ContentKind[];

export const isContentKind = (value: string): value is ContentKind =>
  (contentKinds as readonly string[]).includes(value);

export type ContentOf<K extends ContentKind> = Extract<GameContent, { kind: K }>;
export type ItemOf<K extends ContentKind> = ContentOf<K>['items'][number];

export const blank = '___';
export const maxGameItems = 30;
export const maxItemTextLength = 300;
export const minOptions = 2;
export const maxOptions = 6;

/** Filler a model or a hurried teacher leaves behind (from the original app's validator). */
const placeholderPatterns: readonly RegExp[] = [
  /\btodo\b/i,
  /lorem ipsum/i,
  /your (answer|question|text) here/i,
  /^option [a-f]$/i,
  /\[insert/i,
  /\bplaceholder\b/i,
  /\btbd\b/i,
];

const isPlaceholder = (text: string): boolean =>
  placeholderPatterns.some((pattern) => pattern.test(text.trim()));

const sameText = (a: string): string => a.trim().toLocaleLowerCase();

type Checked<T> = Result<T, ValidationError>;

/** A required, short, non-placeholder text. */
function itemText(field: string, value: string): Checked<string> {
  const text = requiredText(field, value, maxItemTextLength);
  if (!text.ok) return text;
  return isPlaceholder(text.value) ? invalid(field, 'not_allowed') : text;
}

function distinctTexts(field: string, values: readonly string[]): Checked<string[]> {
  const texts: string[] = [];
  for (const value of values) {
    const text = itemText(field, value);
    if (!text.ok) return text;
    if (texts.some((seen) => sameText(seen) === sameText(text.value))) {
      return invalid(field, 'duplicate');
    }
    texts.push(text.value);
  }
  return ok(texts);
}

interface KindRules<K extends ContentKind> {
  readonly minItems: number;
  /** Checks one item; `others` are the items already accepted. */
  check(field: string, item: ItemOf<K>, others: readonly ItemOf<K>[]): Checked<ItemOf<K>>;
}

const questionRules: KindRules<'questions'> = {
  minItems: 3,
  check(field, item) {
    const prompt = itemText(field, item.prompt);
    if (!prompt.ok) return prompt;
    if (item.options.length < minOptions) return invalid(`${field}.options`, 'too_short');
    if (item.options.length > maxOptions) return invalid(`${field}.options`, 'too_long');
    const options = distinctTexts(`${field}.options`, item.options);
    if (!options.ok) return options;
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= options.value.length) {
      return invalid(`${field}.answer`, 'out_of_range');
    }
    return ok({ prompt: prompt.value, options: options.value, answer: item.answer });
  },
};

const statementRules: KindRules<'statements'> = {
  minItems: 3,
  check(field, item) {
    const statement = itemText(field, item.statement);
    return statement.ok ? ok({ statement: statement.value, isTrue: item.isTrue }) : statement;
  },
};

const sentenceRules: KindRules<'sentences'> = {
  minItems: 3,
  check(field, item) {
    const text = itemText(`${field}.text`, item.text);
    if (!text.ok) return text;
    if (text.value.split(blank).length !== 2) return invalid(`${field}.text`, 'invalid_format');
    const answer = itemText(`${field}.answer`, item.answer);
    if (!answer.ok) return answer;
    if (sameText(text.value).includes(sameText(answer.value))) {
      return invalid(`${field}.answer`, 'not_allowed');
    }
    return ok({ text: text.value, answer: answer.value });
  },
};

const pairRules: KindRules<'pairs'> = {
  minItems: 4,
  check(field, item, others) {
    const term = itemText(`${field}.term`, item.term);
    if (!term.ok) return term;
    if (others.some((other) => sameText(other.term) === sameText(term.value))) {
      return invalid(`${field}.term`, 'duplicate');
    }
    const definition = itemText(`${field}.definition`, item.definition);
    return definition.ok ? ok({ term: term.value, definition: definition.value }) : definition;
  },
};

const stepRules: KindRules<'steps'> = {
  minItems: 3,
  check(field, item, others) {
    const step = itemText(field, item);
    if (!step.ok) return step;
    return others.some((other) => sameText(other) === sameText(step.value))
      ? invalid(field, 'duplicate')
      : step;
  },
};

const groupRules: KindRules<'groups'> = {
  minItems: 2,
  check(field, item, others) {
    const name = itemText(`${field}.name`, item.name);
    if (!name.ok) return name;
    if (others.some((other) => sameText(other.name) === sameText(name.value))) {
      return invalid(`${field}.name`, 'duplicate');
    }
    if (item.members.length < 2) return invalid(`${field}.members`, 'too_short');
    const taken = others.flatMap((other) => other.members);
    const members = distinctTexts(`${field}.members`, [...taken, ...item.members]);
    if (!members.ok) return members;
    return ok({ name: name.value, members: members.value.slice(taken.length) });
  },
};

const rulesByKind: { readonly [K in ContentKind]: KindRules<K> } = {
  questions: questionRules,
  statements: statementRules,
  sentences: sentenceRules,
  pairs: pairRules,
  steps: stepRules,
  groups: groupRules,
};

const labelByKind: { readonly [K in ContentKind]: (item: ItemOf<K>) => string } = {
  questions: (item) => item.prompt,
  statements: (item) => item.statement,
  sentences: (item) => item.text,
  pairs: (item) => item.term,
  steps: (item) => item,
  groups: (item) => item.name,
};

function labelsOf<K extends ContentKind>(kind: K, items: readonly ItemOf<K>[]): string[] {
  const label: (item: ItemOf<K>) => string = labelByKind[kind];
  return items.map(label);
}

/** One short label per item (a question's prompt, a pair's term, …). */
export const contentLabels = (content: GameContent): string[] =>
  labelsOf(content.kind, content.items as readonly ItemOf<ContentKind>[]);

/** The fewest items a kind needs. */
export const minItemsFor = (kind: ContentKind): number => rulesByKind[kind].minItems;

function validateItems<K extends ContentKind>(
  kind: K,
  items: readonly ItemOf<K>[],
): Checked<ItemOf<K>[]> {
  const rules: KindRules<K> = rulesByKind[kind];
  if (items.length < rules.minItems) return invalid('items', 'too_short');
  if (items.length > maxGameItems) return invalid('items', 'too_long');
  const accepted: ItemOf<K>[] = [];
  for (const [index, item] of items.entries()) {
    const checked = rules.check(`items.${String(index)}`, item, accepted);
    if (!checked.ok) return checked;
    accepted.push(checked.value);
  }
  return ok(accepted);
}

/** Checks and trims a game's content: the quality rules every game must meet before saving. */
export function validateContent(content: GameContent): Checked<GameContent> {
  const items = validateItems(content.kind, content.items as readonly ItemOf<ContentKind>[]);
  return items.ok ? ok({ kind: content.kind, items: items.value } as GameContent) : items;
}
