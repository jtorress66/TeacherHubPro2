import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown.ts';

const text = (value: string) => ({ kind: 'text', text: value });

describe('parseInline', () => {
  it('reads bold, italic and plain text', () => {
    expect(parseInline('a **b** *c* d')).toEqual([
      text('a '),
      { kind: 'strong', children: [text('b')] },
      text(' '),
      { kind: 'em', children: [text('c')] },
      text(' d'),
    ]);
  });

  it('turns runs of underscores into blanks', () => {
    expect(parseInline('I would like ___, please. Name: __')).toEqual([
      text('I would like '),
      { kind: 'blank' },
      text(', please. Name: '),
      { kind: 'blank' },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('renders escaped underscores as a clean blank, not as \\_\\_', () => {
    expect(parseMarkdown('Answer: \\_\\_\\_\\_')).toEqual([
      { kind: 'paragraph', lines: [[text('Answer: '), { kind: 'blank' }]] },
    ]);
  });

  it('reads a table with a header and drops the |---| line', () => {
    expect(parseMarkdown('| Picture | Fraction |\n|---|:---:|\n| 1 of 4 | 1/4 |')).toEqual([
      {
        kind: 'table',
        header: [[text('Picture')], [text('Fraction')]],
        rows: [[[text('1 of 4')], [text('1/4')]]],
      },
    ]);
  });

  it('reads a table without a header', () => {
    expect(parseMarkdown('| a | b |\n| c | \\| |')).toEqual([
      {
        kind: 'table',
        header: null,
        rows: [
          [[text('a')], [text('b')]],
          [[text('c')], [text('|')]],
        ],
      },
    ]);
  });

  it('reads headings, lists and paragraphs separated by blank lines', () => {
    expect(
      parseMarkdown(
        '## Monday\r\n- one\n- **two**\n\n1. first\n2) second\nLine one\nLine two\n\nAfter',
      ),
    ).toEqual([
      { kind: 'heading', level: 2, content: [text('Monday')] },
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [[text('one')], [{ kind: 'strong', children: [text('two')] }]],
      },
      { kind: 'list', ordered: true, start: 1, items: [[text('first')], [text('second')]] },
      { kind: 'paragraph', lines: [[text('Line one')], [text('Line two')]] },
      { kind: 'paragraph', lines: [[text('After')]] },
    ]);
  });

  it('keeps the number a list starts at, so questions split by their choices count on', () => {
    expect(parseMarkdown('1. Noun?\n\na) tall\nb) girl\n\n2. Verb?\n\n10) Last?')).toEqual([
      { kind: 'list', ordered: true, start: 1, items: [[text('Noun?')]] },
      { kind: 'paragraph', lines: [[text('a) tall')], [text('b) girl')]] },
      { kind: 'list', ordered: true, start: 2, items: [[text('Verb?')]] },
      { kind: 'list', ordered: true, start: 10, items: [[text('Last?')]] },
    ]);
  });

  it('reads a line of dashes or stars as a divider, not as text', () => {
    expect(parseMarkdown('Before\n---\nAfter\n\n--\n* * *')).toEqual([
      { kind: 'paragraph', lines: [[text('Before')]] },
      { kind: 'rule' },
      { kind: 'paragraph', lines: [[text('After')]] },
      { kind: 'rule' },
      { kind: 'rule' },
    ]);
    expect(parseMarkdown('- - item')).toEqual([
      { kind: 'list', ordered: false, start: 1, items: [[text('- item')]] },
    ]);
  });

  it('keeps HTML as plain text', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { kind: 'paragraph', lines: [[text('<script>alert(1)</script>')]] },
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(parseMarkdown('\n  \n')).toEqual([]);
  });
});
