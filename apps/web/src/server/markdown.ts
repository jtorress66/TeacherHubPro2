/**
 * The small Markdown that plans use: headings, paragraphs, lists, tables, **bold**, *italic* and
 * runs of underscores as fill-in-the-blank lines. It returns a tree that React renders as
 * elements, never raw HTML, so plan text cannot inject markup.
 */

export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly children: readonly Inline[] }
  | { readonly kind: 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'blank' };

export type Block =
  | { readonly kind: 'heading'; readonly level: 1 | 2 | 3; readonly content: readonly Inline[] }
  | { readonly kind: 'paragraph'; readonly lines: readonly (readonly Inline[])[] }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly items: readonly (readonly Inline[])[];
    }
  | {
      readonly kind: 'table';
      readonly header: readonly (readonly Inline[])[] | null;
      readonly rows: readonly (readonly (readonly Inline[])[])[];
    };

/** `\_` and other escaped punctuation stand for the character itself. */
const unescape = (text: string): string => text.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');

/** Text with `**strong**`, `*em*` and blanks (two or more underscores). */
export function parseInline(source: string): Inline[] {
  const result: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|_{2,}/g;
  let last = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > last) result.push({ kind: 'text', text: source.slice(last, match.index) });
    const [whole, strong, em] = match;
    if (strong !== undefined) result.push({ kind: 'strong', children: parseInline(strong) });
    else if (em !== undefined) result.push({ kind: 'em', children: parseInline(em) });
    else result.push({ kind: 'blank' });
    last = match.index + whole.length;
  }
  if (last < source.length) result.push({ kind: 'text', text: source.slice(last) });
  return result;
}

/** A table row's cells; an escaped pipe (`\|`) stays inside its cell. */
const cells = (line: string): Inline[][] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => parseInline(unescape(cell.trim())));

const isSeparator = (line: string): boolean =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

const listItem = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const heading = /^(#{1,3})\s+(.*)$/;

function table(lines: readonly string[]): Block {
  const [first, second, ...rest] = lines;
  if (first !== undefined && second !== undefined && isSeparator(second)) {
    return {
      kind: 'table',
      header: cells(first),
      rows: rest.filter((l) => !isSeparator(l)).map(cells),
    };
  }
  return { kind: 'table', header: null, rows: lines.filter((l) => !isSeparator(l)).map(cells) };
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  const take = (matches: (line: string) => boolean): string[] => {
    const taken: string[] = [];
    while (index < lines.length && matches(lines[index] ?? '')) taken.push(lines[index++] ?? '');
    return taken;
  };

  while (index < lines.length) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    const headingMatch = heading.exec(trimmed);
    const itemMatch = listItem.exec(line);
    if (trimmed === '') {
      index++;
    } else if (headingMatch) {
      const level = (headingMatch[1] ?? '#').length as 1 | 2 | 3;
      blocks.push({
        kind: 'heading',
        level,
        content: parseInline(unescape(headingMatch[2] ?? '')),
      });
      index++;
    } else if (trimmed.startsWith('|')) {
      blocks.push(table(take((l) => l.trim().startsWith('|'))));
    } else if (itemMatch) {
      const ordered = itemMatch[2] !== undefined;
      const items = take((l) => {
        const item = listItem.exec(l);
        return item !== null && (item[2] !== undefined) === ordered;
      });
      blocks.push({
        kind: 'list',
        ordered,
        items: items.map((item) => parseInline(unescape(listItem.exec(item)?.[3] ?? ''))),
      });
    } else {
      const paragraph = take(
        (l) =>
          l.trim() !== '' &&
          !l.trim().startsWith('|') &&
          !heading.test(l.trim()) &&
          !listItem.test(l),
      );
      blocks.push({
        kind: 'paragraph',
        lines: paragraph.map((l) => parseInline(unescape(l.trim()))),
      });
    }
  }
  return blocks;
}
