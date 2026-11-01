import type { ContentKind, GameContent, ItemOf } from '@thp/domain';

// Teachers type a game's content as one item per line; each kind has its own simple format.

interface LineFormat<K extends ContentKind> {
  readonly read: (line: string) => ItemOf<K>;
  readonly write: (item: ItemOf<K>) => string;
}

const parts = (line: string, separator: string): string[] =>
  line.split(separator).map((part) => part.trim());

/** Splits at the first separator only, so the rest may contain it. */
function splitOnce(line: string, separator: string): [string, string] {
  const at = line.indexOf(separator);
  return at === -1 ? [line.trim(), ''] : [line.slice(0, at).trim(), line.slice(at + 1).trim()];
}

const correctMark = '*';

const truthWords = new Set([
  'true',
  't',
  'yes',
  'y',
  'verdadero',
  'v',
  'sí',
  'si',
  'vrai',
  'oui',
  'wahr',
  'ja',
  'verdadeiro',
  'sim',
  'vero',
  'vera',
  'certo',
  '对',
  '是',
  '正确',
]);

const questions: LineFormat<'questions'> = {
  read(line) {
    const [prompt = '', ...marked] = parts(line, '|');
    const options = marked.map((option) => option.replace(/^\*\s*/u, ''));
    return { prompt, options, answer: marked.findIndex((o) => o.startsWith(correctMark)) };
  },
  write: (item) =>
    [
      item.prompt,
      ...item.options.map((o, i) => (i === item.answer ? `${correctMark}${o}` : o)),
    ].join(' | '),
};

const statements: LineFormat<'statements'> = {
  read(line) {
    const [statement, truth] = splitOnce(line, '|');
    return { statement, isTrue: truthWords.has(truth.toLocaleLowerCase()) };
  },
  write: (item) => `${item.statement} | ${item.isTrue ? 'true' : 'false'}`,
};

const sentences: LineFormat<'sentences'> = {
  read(line) {
    const [text, answer] = splitOnce(line, '|');
    return { text, answer };
  },
  write: (item) => `${item.text} | ${item.answer}`,
};

const pairs: LineFormat<'pairs'> = {
  read(line) {
    const [term, definition] = splitOnce(line, '=');
    return { term, definition };
  },
  write: (item) => `${item.term} = ${item.definition}`,
};

const steps: LineFormat<'steps'> = {
  read: (line) => line.trim(),
  write: (item) => item,
};

const groups: LineFormat<'groups'> = {
  read(line) {
    const [name, members] = splitOnce(line, ':');
    return { name, members: parts(members, ',').filter((member) => member !== '') };
  },
  write: (item) => `${item.name}: ${item.members.join(', ')}`,
};

const formats: { readonly [K in ContentKind]: LineFormat<K> } = {
  questions,
  statements,
  sentences,
  pairs,
  steps,
  groups,
};

function readAll<K extends ContentKind>(
  kind: K,
  lines: readonly string[],
): { readonly kind: K; readonly items: readonly ItemOf<K>[] } {
  const format: LineFormat<K> = formats[kind];
  return { kind, items: lines.map(format.read) };
}

/** The content typed in the editor; the domain's checks report anything wrong per item. */
export function parseContentText(kind: ContentKind, text: string): GameContent {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return readAll(kind, lines) as GameContent;
}

function writeAll<K extends ContentKind>(kind: K, items: readonly ItemOf<K>[]): string {
  const format: LineFormat<K> = formats[kind];
  return items.map(format.write).join('\n');
}

/** The content as editor text. */
export const contentText = (content: GameContent): string =>
  writeAll(content.kind, content.items as readonly ItemOf<ContentKind>[]);
