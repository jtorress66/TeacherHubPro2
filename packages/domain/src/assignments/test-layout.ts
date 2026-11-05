import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

/** One piece of a printed test, kept as printed: wording, numbering and letters. */
export type TestBlock =
  | { readonly kind: 'header'; readonly left: string; readonly right: string }
  | { readonly kind: 'fields'; readonly labels: readonly string[] }
  | { readonly kind: 'section'; readonly text: string }
  | { readonly kind: 'part'; readonly title: string; readonly instructions?: string | null }
  | { readonly kind: 'bank'; readonly words: readonly string[]; readonly columns: number }
  | { readonly kind: 'passage'; readonly text: string }
  | {
      readonly kind: 'columns';
      readonly headings?: readonly [string, string] | null;
      readonly rows: readonly (readonly [string, string])[];
    }
  | { readonly kind: 'items'; readonly items: readonly TestItem[] }
  | { readonly kind: 'text'; readonly text: string; readonly bold?: boolean }
  | { readonly kind: 'lines'; readonly count: number };

export interface TestItem {
  /** As printed, e.g. "1." or "a)". */
  readonly label: string;
  readonly text: string;
  /** Printed after the item, e.g. "True / False". */
  readonly choice?: string | null;
}

/** A test's layout, transcribed as printed, for a document students type in. */
export interface TestLayout {
  readonly blocks: readonly TestBlock[];
}

export const testBlockKinds = [
  'header',
  'fields',
  'section',
  'part',
  'bank',
  'passage',
  'columns',
  'items',
  'text',
  'lines',
] as const satisfies readonly TestBlock['kind'][];

export const maxLayoutBlocks = 400;
const maxTextLength = 2000;
const maxLines = 40;
const maxBankColumns = 6;

type Checked<T> = Result<T, ValidationError['code']>;

function textOf(value: string): Checked<string> {
  const text = value.trim();
  if (text === '') return { ok: false, error: 'required' };
  return text.length > maxTextLength ? { ok: false, error: 'too_long' } : ok(text);
}

function textsOf(values: readonly string[]): Checked<string[]> {
  if (values.length === 0) return { ok: false, error: 'required' };
  const texts: string[] = [];
  for (const value of values) {
    const text = textOf(value);
    if (!text.ok) return text;
    texts.push(text.value);
  }
  return ok(texts);
}

const optionalTextOf = (value: string | null | undefined): Checked<string | null> =>
  value == null || value.trim() === '' ? ok(null) : textOf(value);

const inRange = (value: number, max: number) =>
  Number.isInteger(value) && value >= 1 && value <= max;

type Rules = {
  [K in TestBlock['kind']]: (block: Extract<TestBlock, { kind: K }>) => Checked<TestBlock>;
};

/** How each block is checked and tidied; a new kind adds an entry here. */
const rules: Rules = {
  header: (block) => {
    const left = optionalTextOf(block.left);
    const right = optionalTextOf(block.right);
    if (!left.ok) return left;
    if (!right.ok) return right;
    if (left.value === null && right.value === null) return { ok: false, error: 'required' };
    return ok({ kind: 'header', left: left.value ?? '', right: right.value ?? '' });
  },
  fields: (block) => {
    const labels = textsOf(block.labels);
    return labels.ok ? ok({ kind: 'fields', labels: labels.value }) : labels;
  },
  section: (block) => {
    const text = textOf(block.text);
    return text.ok ? ok({ kind: 'section', text: text.value }) : text;
  },
  part: (block) => {
    const title = textOf(block.title);
    if (!title.ok) return title;
    const instructions = optionalTextOf(block.instructions);
    if (!instructions.ok) return instructions;
    return ok({ kind: 'part', title: title.value, instructions: instructions.value });
  },
  bank: (block) => {
    if (!inRange(block.columns, maxBankColumns)) return { ok: false, error: 'out_of_range' };
    const words = textsOf(block.words);
    return words.ok ? ok({ kind: 'bank', words: words.value, columns: block.columns }) : words;
  },
  passage: (block) => {
    const text = textOf(block.text);
    return text.ok ? ok({ kind: 'passage', text: text.value }) : text;
  },
  columns: (block) => {
    if (block.rows.length === 0) return { ok: false, error: 'required' };
    const rows: (readonly [string, string])[] = [];
    for (const [leftCell, rightCell] of block.rows) {
      const left = optionalTextOf(leftCell);
      if (!left.ok) return left;
      const right = optionalTextOf(rightCell);
      if (!right.ok) return right;
      rows.push([left.value ?? '', right.value ?? '']);
    }
    const headings = block.headings == null ? null : textsOf(block.headings);
    if (headings !== null && !headings.ok) return headings;
    return ok({
      kind: 'columns',
      headings: headings === null ? null : [headings.value[0] ?? '', headings.value[1] ?? ''],
      rows,
    });
  },
  items: (block) => {
    if (block.items.length === 0) return { ok: false, error: 'required' };
    const items: TestItem[] = [];
    for (const item of block.items) {
      const label = optionalTextOf(item.label);
      const text = textOf(item.text);
      const choice = optionalTextOf(item.choice);
      if (!label.ok) return label;
      if (!text.ok) return text;
      if (!choice.ok) return choice;
      items.push({ label: label.value ?? '', text: text.value, choice: choice.value });
    }
    return ok({ kind: 'items', items });
  },
  text: (block) => {
    const text = textOf(block.text);
    return text.ok ? ok({ kind: 'text', text: text.value, bold: block.bold === true }) : text;
  },
  lines: (block) =>
    inRange(block.count, maxLines) ? ok(block) : { ok: false, error: 'out_of_range' },
};

/** A layout's blocks checked and tidied; a broken block is named by its position. */
export function createTestLayout(input: TestLayout): Result<TestLayout, ValidationError> {
  if (input.blocks.length === 0) return invalid('blocks', 'required');
  if (input.blocks.length > maxLayoutBlocks) return invalid('blocks', 'too_large');
  const blocks: TestBlock[] = [];
  for (const [index, block] of input.blocks.entries()) {
    const rule = rules[block.kind] as (block: TestBlock) => Checked<TestBlock>;
    const checked = rule(block);
    if (!checked.ok) return invalid(`blocks.${String(index)}`, checked.error);
    blocks.push(checked.value);
  }
  return ok({ blocks });
}

const escape = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The first field (the name) gets the long blank, the rest a shorter one, as printed tests do. */
const fieldBlank = (index: number) => '_'.repeat(index === 0 ? 30 : 16);
const answerLine = `<p>${'_'.repeat(70)}</p>`;

type Renderers = { [K in TestBlock['kind']]: (block: Extract<TestBlock, { kind: K }>) => string };

/** Plain paragraphs and tables only, which Google Docs keeps as they are. */
const renderers: Renderers = {
  header: (block) =>
    `<table style="width:100%"><tr><td><b>${escape(block.left)}</b></td><td style="text-align:right"><b>${escape(block.right)}</b></td></tr></table>`,
  fields: (block) =>
    `<p>${block.labels.map((label, index) => `<b>${escape(label)}</b> ${fieldBlank(index)}`).join(' &nbsp; ')}</p>`,
  section: (block) => `<p><b>${escape(block.text)}</b></p>`,
  part: (block) =>
    `<p><b>${escape(block.title)}</b>${block.instructions == null ? '' : `<br>${escape(block.instructions)}`}</p>`,
  bank: (block) => {
    const rows: string[] = [];
    for (let start = 0; start < block.words.length; start += block.columns) {
      const cells = block.words
        .slice(start, start + block.columns)
        .map((word) => `<td style="text-align:center">${escape(word)}</td>`);
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    return `<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">${rows.join('')}</table>`;
  },
  passage: (block) =>
    `<table border="1" cellpadding="10" style="border-collapse:collapse"><tr><td>${escape(block.text)}</td></tr></table>`,
  columns: (block) => {
    const head =
      block.headings == null
        ? ''
        : `<tr><td><b>${escape(block.headings[0])}</b></td><td><b>${escape(block.headings[1])}</b></td></tr>`;
    const rows = block.rows.map(
      ([left, right]) => `<tr><td>${escape(left)}</td><td>${escape(right)}</td></tr>`,
    );
    return `<table cellpadding="6" style="width:100%">${head}${rows.join('')}</table>`;
  },
  items: (block) =>
    block.items
      .map((item) => {
        const label = item.label === '' ? '' : `<b>${escape(item.label)}</b> `;
        const choice = item.choice == null ? '' : ` (<b>${escape(item.choice)}</b>)`;
        return `<p>${label}${escape(item.text)}${choice}</p>`;
      })
      .join(''),
  text: (block) =>
    block.bold === true ? `<p><b>${escape(block.text)}</b></p>` : `<p>${escape(block.text)}</p>`,
  lines: (block) => answerLine.repeat(block.count),
};

/** Docs and Word do not pass the body's font on to table cells, so each is named. */
const style = 'body,p,td{font-family:Arial,sans-serif;font-size:11pt}';

/**
 * A transcribed test as HTML that Google Drive converts to a Google Doc: one plain font, bold
 * titles, tables for the header, matching columns and boxes, and every text as printed.
 */
export function renderTestLayout(layout: TestLayout): string {
  const body = layout.blocks
    .map((block) => (renderers[block.kind] as (block: TestBlock) => string)(block))
    .join('');
  return `<html><head><meta charset="utf-8"><style>${style}</style></head><body>${body}</body></html>`;
}
