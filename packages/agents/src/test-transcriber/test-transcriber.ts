import {
  createTestLayout,
  err,
  ok,
  testBlockKinds,
  type Result,
  type TestBlock,
  type TestLayout,
} from '@thp/domain';
import type {
  DraftError,
  LlmClient,
  LlmResponse,
  TestTranscriber as TestTranscriberPort,
} from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { objects, parseJsonObject, text, texts, type Json } from '../drafting/json-reply.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';
import { maxTestTextLength } from '../question-extractor/question-extractor.ts';

const maxTokens = 16000;
/** A word or two may differ (a split word, a stray symbol); more means words were added. */
const inventedShare = 0.02;

export const transcriberSystemPrompt = `You copy a printed test into layout blocks so it can be rebuilt as a clean document that students type in.
Rules:
1. Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
2. Copy every word, number and letter exactly as printed, in the same order. Never add, reword, reorder, renumber or answer anything.
3. Keep the test's own numbering and letters ("1.", "a.") and its blanks ("______") as printed.
4. The running header (book title, chapter) is one "header" block, once, at the top. The name and date line is one "fields" block.
5. "Section 1: …" is a "section" block. A lettered part such as "A. Matching Definitions (5 points)" is a "part" block, with the sentence that tells students what to do as its "instructions".
6. Two side-by-side lists (such as Words and Definitions) are one "columns" block: each row is the left text and the right text of one printed line.
7. A word bank is a "bank" block with its words and the number of columns it is printed in. A reading passage is a "passage" block.
8. Numbered questions are an "items" block. Put a printed choice that follows a question, such as "(True / False)", in "choice" without the parentheses.
9. Anything else (an example, a note) is a "text" block; empty answer lines are a "lines" block.
10. Leave out page numbers and repeated running headers.`;

const shape = `{
  "blocks": [
    one of:
    { "kind": "header", "left": string, "right": string },
    { "kind": "fields", "labels": [string] },
    { "kind": "section", "text": string },
    { "kind": "part", "title": string, "instructions": string or null },
    { "kind": "bank", "words": [string], "columns": number },
    { "kind": "passage", "text": string },
    { "kind": "columns", "headings": [string, string] or null, "rows": [[string, string]] },
    { "kind": "items", "items": [{ "label": string, "text": string, "choice": string or null }] },
    { "kind": "text", "text": string, "bold": boolean },
    { "kind": "lines", "count": number }
  ]
}`;

type Readers = { [K in TestBlock['kind']]: (block: Json) => Extract<TestBlock, { kind: K }> };

const cell = (value: unknown): string => (typeof value === 'string' ? value : '');

/** How each block kind is read from the reply. A new kind adds an entry here. */
const readers: Readers = {
  header: (b) => ({ kind: 'header', left: cell(b.left), right: cell(b.right) }),
  fields: (b) => ({ kind: 'fields', labels: texts(b.labels) }),
  section: (b) => ({ kind: 'section', text: cell(b.text) }),
  part: (b) => ({ kind: 'part', title: cell(b.title), instructions: text(b.instructions) }),
  bank: (b) => ({
    kind: 'bank',
    words: texts(b.words),
    columns: typeof b.columns === 'number' ? b.columns : 3,
  }),
  passage: (b) => ({ kind: 'passage', text: cell(b.text) }),
  columns: (b) => {
    const headings = texts(b.headings);
    return {
      kind: 'columns',
      headings: headings.length === 2 ? [headings[0] ?? '', headings[1] ?? ''] : null,
      rows: (Array.isArray(b.rows) ? (b.rows as unknown[]) : []).map((row) => {
        const cells = Array.isArray(row) ? (row as unknown[]) : [];
        return [cell(cells[0]), cell(cells[1])] as const;
      }),
    };
  },
  items: (b) => ({
    kind: 'items',
    items: objects(b.items).map((item) => ({
      label: cell(item.label),
      text: cell(item.text),
      choice: text(item.choice),
    })),
  }),
  text: (b) => ({ kind: 'text', text: cell(b.text), bold: b.bold === true }),
  lines: (b) => ({ kind: 'lines', count: typeof b.count === 'number' ? b.count : 0 }),
};

const isKind = (value: unknown): value is TestBlock['kind'] =>
  typeof value === 'string' && (testBlockKinds as readonly string[]).includes(value);

/** Every piece of text a layout shows. */
export function layoutTexts(layout: TestLayout): string[] {
  return layout.blocks.flatMap((block): string[] => {
    switch (block.kind) {
      case 'header':
        return [block.left, block.right];
      case 'fields':
        return [...block.labels];
      case 'part':
        return [block.title, block.instructions ?? ''];
      case 'bank':
        return [...block.words];
      case 'columns':
        return [...(block.headings ?? []), ...block.rows.flat()];
      case 'items':
        return block.items.flatMap((item) => [item.label, item.text, item.choice ?? '']);
      case 'lines':
        return [];
      default:
        return [block.text];
    }
  });
}

const words = (value: string): string[] => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Words the layout shows that the test's text does not have (a word split by a line is kept). */
export function inventedWords(layout: TestLayout, source: string): string[] {
  const known = new Set([...words(source), ...words(source.replace(/-\s*\n\s*/g, ''))]);
  return [...new Set(layoutTexts(layout).flatMap(words))].filter((word) => !known.has(word));
}

/** The layout in a reply, or what is wrong with it in plain words. */
export function reviewTranscription(
  reply: LlmResponse,
  source: string,
): Result<TestLayout, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; copy the test again more compactly.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const blocks: TestBlock[] = [];
  for (const raw of objects(json.blocks)) {
    if (!isKind(raw.kind)) return err(`The reply has an unknown block "${String(raw.kind)}".`);
    blocks.push((readers[raw.kind] as (block: Json) => TestBlock)(raw));
  }
  const layout = createTestLayout({ blocks });
  if (!layout.ok) return err(ruleBroken(layout.error));
  const invented = inventedWords(layout.value, source);
  const total = layoutTexts(layout.value).flatMap(words).length;
  if (invented.length > Math.floor(total * inventedShare)) {
    return err(
      `The reply has words that are not in the test: ${invented.slice(0, 10).join(', ')}. Copy the test exactly; never add anything.`,
    );
  }
  return ok(layout.value);
}

/**
 * Copies a printed test's layout (numbering, letters, boxes, columns) from its PDF text, so the
 * document students type in looks like the test. It sends only the test's text, never student
 * data, and refuses replies that add words the test does not have.
 */
export class TestTranscriber implements TestTranscriberPort {
  constructor(private readonly llm: LlmClient) {}

  transcribe(input: { readonly text: string }): Promise<Result<TestLayout, DraftError>> {
    const source = input.text.slice(0, maxTestTextLength);
    const prompt = [
      'Copy this test into layout blocks.',
      `Reply with JSON in this shape:\n${shape}`,
      `The test:\n"""\n${source}\n"""`,
    ].join('\n\n');
    return draftWithReview(this.llm, {
      system: transcriberSystemPrompt,
      prompt,
      maxTokens,
      review: (reply) => reviewTranscription(reply, source),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
