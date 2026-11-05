import { describe, expect, it } from 'vitest';
import {
  createTestLayout,
  maxLayoutBlocks,
  renderTestLayout,
  type TestBlock,
  type TestLayout,
} from './test-layout.ts';

const layout = (...blocks: TestBlock[]): TestLayout => ({ blocks });

/** Chapter 03 – Try It!, part of page 1, as printed. */
const chapter3: TestLayout = layout(
  {
    kind: 'header',
    left: 'Revuela English - Student Book 4 Assessment',
    right: 'Chapter 03 – Try It!',
  },
  { kind: 'fields', labels: ['Student Name:', 'Date:'] },
  { kind: 'section', text: 'Section 1: Vocabulary' },
  {
    kind: 'part',
    title: 'A. Matching Definitions (5 points)',
    instructions:
      'Match each word to its correct definition by writing the letter next to the word.',
  },
  {
    kind: 'columns',
    headings: ['Words:', 'Definitions:'],
    rows: [
      ['______ 1. comfort zones', 'a. to feel uncomfortable or ashamed'],
      ['______ 2. challenging', 'b. places where we feel safe'],
    ],
  },
  {
    kind: 'part',
    title: 'B. Choosing the Right Word (5 points)',
    instructions: 'Use the words to complete each sentence.',
  },
  {
    kind: 'bank',
    words: ['avoid', 'confidence', 'proud', 'shy', 'strangers', 'ushered'],
    columns: 3,
  },
  {
    kind: 'items',
    items: [
      { label: '1.', text: 'It is important to _______________ bad habits.' },
      { label: '2.', text: 'The teacher _______________ the students to their seats.' },
    ],
  },
);

describe('renderTestLayout', () => {
  it('keeps the test exactly as printed: numbering, letters and order', () => {
    const html = renderTestLayout(chapter3);
    const order = [
      'Revuela English - Student Book 4 Assessment',
      'Student Name:',
      'Section 1: Vocabulary',
      'A. Matching Definitions (5 points)',
      '______ 1. comfort zones',
      'a. to feel uncomfortable or ashamed',
      '______ 2. challenging',
      'b. places where we feel safe',
      'B. Choosing the Right Word (5 points)',
      'avoid',
      '<b>1.</b> It is important to _______________ bad habits.',
      '<b>2.</b> The teacher',
    ].map((text) => html.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('uses one plain font and small bold titles, never big headings', () => {
    const html = renderTestLayout(chapter3);
    expect(html).toContain('<meta charset="utf-8">');
    // Docs and Word do not pass the body's font on to table cells.
    expect(html).toContain('<style>body,p,td{font-family:Arial,sans-serif;font-size:11pt}</style>');
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).toContain('<p><b>Section 1: Vocabulary</b></p>');
    expect(html).toContain(
      '<p><b>A. Matching Definitions (5 points)</b><br>Match each word to its correct definition by writing the letter next to the word.</p>',
    );
  });

  it('puts the header in two cells and the name fields on one line', () => {
    const html = renderTestLayout(chapter3);
    expect(html).toContain(
      '<td><b>Revuela English - Student Book 4 Assessment</b></td><td style="text-align:right"><b>Chapter 03 – Try It!</b></td>',
    );
    expect(html).toContain(
      '<p><b>Student Name:</b> ______________________________ &nbsp; <b>Date:</b> ________________</p>',
    );
  });

  it('lays out matching as two columns with bold headings', () => {
    const html = renderTestLayout(chapter3);
    expect(html).toContain('<tr><td><b>Words:</b></td><td><b>Definitions:</b></td></tr>');
    expect(html).toContain(
      '<tr><td>______ 1. comfort zones</td><td>a. to feel uncomfortable or ashamed</td></tr>',
    );
  });

  it('boxes a word bank in a grid of the printed columns', () => {
    const html = renderTestLayout(chapter3);
    expect(html).toContain('border="1"');
    expect(html).toContain(
      '<tr><td style="text-align:center">avoid</td><td style="text-align:center">confidence</td><td style="text-align:center">proud</td></tr><tr><td style="text-align:center">shy</td>',
    );
  });

  it('boxes a passage, adds choices at the end of an item, and draws answer lines', () => {
    const html = renderTestLayout(
      layout(
        { kind: 'passage', text: 'Maria stared at the swimming pool.' },
        {
          kind: 'items',
          items: [{ label: '1.', text: 'Maria will never dive again.', choice: 'True / False' }],
        },
        { kind: 'text', text: 'Example:', bold: true },
        { kind: 'text', text: 'Luis: I don’t know if I can do this.' },
        { kind: 'lines', count: 2 },
      ),
    );
    expect(html).toContain(
      '<table border="1" cellpadding="10" style="border-collapse:collapse"><tr><td>Maria stared at the swimming pool.</td></tr></table>',
    );
    expect(html).toContain('<p><b>1.</b> Maria will never dive again. (<b>True / False</b>)</p>');
    expect(html).toContain('<p><b>Example:</b></p><p>Luis: I don’t know if I can do this.</p>');
    expect(html.match(/<p>_{70}<\/p>/g)).toHaveLength(2);
  });

  it('escapes every text', () => {
    const html = renderTestLayout(
      layout({ kind: 'text', text: '<img src=x onerror=alert(1)> & "q"' }),
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;');
    expect(html).not.toContain('<img');
  });
});

describe('createTestLayout', () => {
  it('accepts a layout with content and trims its text', () => {
    const made = createTestLayout(layout({ kind: 'section', text: '  Section 1  ' }));
    expect(made).toEqual({ ok: true, value: layout({ kind: 'section', text: 'Section 1' }) });
  });

  it('refuses an empty layout, too many blocks, or blank and over-long text', () => {
    expect(createTestLayout(layout())).toEqual({
      ok: false,
      error: { field: 'blocks', code: 'required' },
    });
    const many = Array.from({ length: maxLayoutBlocks + 1 }, () => ({
      kind: 'section' as const,
      text: 'x',
    }));
    expect(createTestLayout(layout(...many))).toEqual({
      ok: false,
      error: { field: 'blocks', code: 'too_large' },
    });
    expect(createTestLayout(layout({ kind: 'passage', text: ' ' }))).toEqual({
      ok: false,
      error: { field: 'blocks.0', code: 'required' },
    });
    expect(createTestLayout(layout({ kind: 'text', text: 'x'.repeat(2001) }))).toEqual({
      ok: false,
      error: { field: 'blocks.0', code: 'too_long' },
    });
  });

  it('refuses empty lists and out-of-range counts', () => {
    const refused = (block: TestBlock) => createTestLayout(layout(block)).ok;
    expect(refused({ kind: 'items', items: [] })).toBe(false);
    expect(refused({ kind: 'columns', rows: [] })).toBe(false);
    expect(refused({ kind: 'bank', words: [], columns: 3 })).toBe(false);
    expect(refused({ kind: 'bank', words: ['a'], columns: 0 })).toBe(false);
    expect(refused({ kind: 'lines', count: 0 })).toBe(false);
    expect(refused({ kind: 'lines', count: 41 })).toBe(false);
    expect(refused({ kind: 'fields', labels: [] })).toBe(false);
    expect(refused({ kind: 'lines', count: 4 })).toBe(true);
  });
});
