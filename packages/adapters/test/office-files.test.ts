import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type GoogleDeck } from '@thp/domain';
import { DocxDocumentWriter } from '../src/documents/docx-document-writer.ts';
import { PptxPresentationWriter } from '../src/documents/pptx-presentation-writer.ts';

/** Every XML part of an Office file whose path matches, joined. */
async function xml(bytes: Uint8Array, path: RegExp): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files)
    .filter((name) => path.test(name))
    .sort();
  const texts = await Promise.all(
    parts.map((name) => zip.file(name)?.async('string') ?? Promise.resolve('')),
  );
  return texts.join('\n');
}

const deck: GoogleDeck = {
  name: 'Volcanoes',
  colours: { background: '#1d4ed8', text: '#ffffff' },
  slides: [
    {
      layout: 'title',
      title: '🌋 Volcanoes',
      body: [{ text: 'Mountains of fire', bullet: false }],
    },
    {
      layout: 'body',
      title: 'How they form',
      body: [
        { text: 'Under the crust', bullet: false },
        { text: 'Heat & pressure', bullet: true },
      ],
    },
  ],
};

describe('PptxPresentationWriter', () => {
  it('writes one PowerPoint slide per slide, with its text, bullets and theme colours', async () => {
    const bytes = await new PptxPresentationWriter().pptx(deck);
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    const slides = await xml(bytes, /^ppt\/slides\/slide\d+\.xml$/);

    expect(slides.match(/<p:sld[\s>]/g)).toHaveLength(2);
    for (const text of [
      '🌋 Volcanoes',
      'Mountains of fire',
      'How they form',
      'Heat &amp; pressure',
    ])
      expect(slides).toContain(text);
    expect(slides).toContain('1D4ED8');
    expect(slides).toContain('FFFFFF');
    expect(slides).toContain('<a:buChar');
  });

  it('gives an empty presentation a title slide, so Canva has a page to open', async () => {
    const bytes = await new PptxPresentationWriter().pptx({ ...deck, slides: [] });
    const slides = await xml(bytes, /^ppt\/slides\/slide\d+\.xml$/);
    expect(slides.match(/<p:sld[\s>]/g)).toHaveLength(1);
    expect(slides).toContain('Volcanoes');
  });
});

describe('DocxDocumentWriter', () => {
  it('keeps headings, numbered and bulleted lists, tables, bold, italics, blanks and dividers', async () => {
    const blocks = parseMarkdown(
      [
        '# Fractions',
        'Name: ____',
        'Read *carefully*.',
        '',
        '1. **Add** 1/2 + 1/4',
        '2. Simplify 2/4',
        '',
        '- Show your work',
        '',
        '---',
        '| Fraction | Decimal |',
        '| --- | --- |',
        '| 1/2 | 0.5 |',
      ].join('\n'),
    );
    const bytes = await new DocxDocumentWriter().docx({ title: 'Fractions', blocks });
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    const body = await xml(bytes, /^word\/document\.xml$/);

    expect(body).toContain('<w:pStyle w:val="Heading1"/>');
    expect(body).toContain('__________');
    expect(body).toMatch(/<w:i\/>.*carefully/s);
    expect(body).toMatch(/<w:b\/>.*Add/s);
    expect(body).toContain('1. ');
    expect(body).toContain('2. ');
    expect(body).toContain('<w:numPr>');
    expect(body).toContain('<w:pBdr>');
    expect(body).toContain('<w:tbl>');
    for (const text of ['Fraction', 'Decimal', '1/2', '0.5', 'Show your work'])
      expect(body).toContain(text);
    expect(await xml(bytes, /^docProps\/core\.xml$/)).toContain('Fractions');
  });

  it('keeps counting questions whose answer choices come between them', async () => {
    const blocks = parseMarkdown('1. Noun?\n\na) girl\n\n2. Verb?\n\nb) sang\n\n3. Adverb?');
    const body = await xml(
      await new DocxDocumentWriter().docx({ title: 'Quiz', blocks }),
      /^word\/document\.xml$/,
    );
    expect(body).toContain('1. ');
    expect(body).toContain('2. ');
    expect(body).toContain('3. ');
  });
});
