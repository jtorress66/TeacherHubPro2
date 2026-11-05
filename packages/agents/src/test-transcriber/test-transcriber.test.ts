import { describe, expect, it } from 'vitest';
import { FakeLlmClient, unwrap } from '@thp/testing';
import {
  inventedWords,
  reviewTranscription,
  TestTranscriber,
  transcriberSystemPrompt,
} from './test-transcriber.ts';

const pdfText = [
  'Revuela English - Student Book 4 Assessment Chapter 03 – Try It!',
  'Student Name: ________ Date: ________',
  'Section 1: Vocabulary',
  'A. Matching Definitions (5 points)',
  'Match each word to its correct definition by writing',
  'the letter next to the word.',
  'Words: Definitions:',
  '______ 1. comfort zones a. to feel uncomfortable or ashamed',
  '______ 2. challenging b. places where we feel safe',
  'B. Choosing the Right Word (5 points)',
  'avoid confidence proud',
  'shy strangers ushered',
  '1. It is important to ______ bad habits.',
  '2. Maria will probably never try diving again. (True / False)',
].join('\n');

const layout = {
  blocks: [
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
    { kind: 'part', title: 'B. Choosing the Right Word (5 points)', instructions: null },
    {
      kind: 'bank',
      words: ['avoid', 'confidence', 'proud', 'shy', 'strangers', 'ushered'],
      columns: 3,
    },
    {
      kind: 'items',
      items: [
        { label: '1.', text: 'It is important to ______ bad habits.' },
        {
          label: '2.',
          text: 'Maria will probably never try diving again.',
          choice: 'True / False',
        },
      ],
    },
  ],
};

const reply = (value: unknown = layout) => JSON.stringify(value);

describe('TestTranscriber', () => {
  it('sends only the test text with the copy-as-printed rules', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new TestTranscriber(llm).transcribe({ text: pdfText });

    const [sent] = llm.requests;
    expect(sent?.system).toBe(transcriberSystemPrompt);
    expect(sent?.system).toMatch(/never add, reword, reorder, renumber or answer/i);
    expect(sent?.messages[0]?.content).toContain('______ 1. comfort zones');
  });

  it('returns the layout as printed, numbering and letters kept', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply()}\n\`\`\``);
    const result = unwrap(await new TestTranscriber(llm).transcribe({ text: pdfText }));

    expect(result.blocks.map((block) => block.kind)).toEqual([
      'header',
      'fields',
      'section',
      'part',
      'columns',
      'part',
      'bank',
      'items',
    ]);
    expect(result.blocks[4]).toMatchObject({
      rows: [['______ 1. comfort zones', 'a. to feel uncomfortable or ashamed'], expect.anything()],
    });
    expect(result.blocks[7]).toMatchObject({
      items: [
        { label: '1.', text: 'It is important to ______ bad habits.', choice: null },
        { label: '2.', choice: 'True / False' },
      ],
    });
  });

  it('asks again when the reply adds words that are not in the test', async () => {
    const invented = {
      blocks: [
        ...layout.blocks,
        { kind: 'text', text: 'Answer key: 1. b 2. a, remember photosynthesis' },
      ],
    };
    const llm = new FakeLlmClient().replyWith(reply(invented)).replyWith(reply());
    unwrap(await new TestTranscriber(llm).transcribe({ text: pdfText }));

    const retry = llm.requests[1]?.messages[2]?.content ?? '';
    expect(retry).toMatch(/words that are not in the test/);
    expect(retry).toContain('photosynthesis');
  });

  it('asks again for an unknown block, a broken block or a cut-off reply, then gives up', async () => {
    const unknown = { blocks: [{ kind: 'image', src: 'x' }] };
    const llm = new FakeLlmClient()
      .replyWith(reply(unknown))
      .replyWith(reply({ blocks: [{ kind: 'lines', count: 0 }] }));
    expect(await new TestTranscriber(llm).transcribe({ text: pdfText })).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    // The conversation grows after each reply, so the first retry is message 3.
    expect(llm.requests[1]?.messages[2]?.content).toMatch(/unknown block "image"/);

    const cut = new FakeLlmClient().replyWith(reply(), 'max_tokens').replyWith('not json');
    expect(await new TestTranscriber(cut).transcribe({ text: pdfText })).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(cut.requests[1]?.messages[2]?.content).toMatch(/cut off/);
  });

  it('reports an unavailable model', async () => {
    const llm = new FakeLlmClient().failWith('unavailable');
    expect(await new TestTranscriber(llm).transcribe({ text: pdfText })).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });
});

describe('reading a reply', () => {
  const source = 'Unit 1 Name Date Section passage text Words Meanings a b 1 2 note';

  it('reads every block kind, filling gaps safely', () => {
    const odd = {
      blocks: [
        { kind: 'header', left: 'Unit 1', right: 7 },
        { kind: 'fields', labels: ['Name', 'Date'] },
        { kind: 'section', text: 'Section' },
        { kind: 'passage', text: 'passage text' },
        { kind: 'bank', words: ['a', 'b'] },
        { kind: 'columns', headings: ['Words'], rows: [['1', 'a'], 'not a row', ['2']] },
        { kind: 'text', text: 'note', bold: 'yes' },
        { kind: 'lines', count: 2 },
      ],
    };
    const result = reviewTranscription({ text: JSON.stringify(odd), stopReason: 'end' }, source);
    expect(result.ok && result.value.blocks).toEqual([
      { kind: 'header', left: 'Unit 1', right: '' },
      { kind: 'fields', labels: ['Name', 'Date'] },
      { kind: 'section', text: 'Section' },
      { kind: 'passage', text: 'passage text' },
      { kind: 'bank', words: ['a', 'b'], columns: 3 },
      {
        kind: 'columns',
        headings: null,
        rows: [
          ['1', 'a'],
          ['', ''],
          ['2', ''],
        ],
      },
      { kind: 'text', text: 'note', bold: false },
      { kind: 'lines', count: 2 },
    ]);
  });

  it('refuses lines without a count and a reply that is not JSON', () => {
    expect(
      reviewTranscription({ text: '{"blocks":[{"kind":"lines"}]}', stopReason: 'end' }, source).ok,
    ).toBe(false);
    expect(reviewTranscription({ text: 'Sure! Here it is.', stopReason: 'end' }, source)).toEqual({
      ok: false,
      error: 'The reply was not one JSON object.',
    });
  });
});

describe('inventedWords', () => {
  it('finds words the layout has but the text does not, ignoring case, blanks and punctuation', () => {
    expect(
      inventedWords(
        { blocks: [{ kind: 'text', text: 'COMFORT zones, ____ (True / False)!' }] },
        pdfText,
      ),
    ).toEqual([]);
    expect(
      inventedWords({ blocks: [{ kind: 'text', text: 'comfort zones photosynthesis' }] }, pdfText),
    ).toEqual(['photosynthesis']);
  });

  it('accepts a word split across lines in the PDF', () => {
    expect(
      inventedWords(
        { blocks: [{ kind: 'text', text: 'underline it' }] },
        'Read and under-\nline it',
      ),
    ).toEqual([]);
  });
});
