import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { documentTextExtractorContract } from '@thp/testing';
import { DocxTextExtractor } from '../src/documents/docx-text-extractor.ts';

async function makeDocx(children: (Paragraph | Table)[]): Promise<Uint8Array> {
  const buffer = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  return new Uint8Array(buffer);
}

const guide = await makeDocx([
  new Paragraph({ children: [new TextRun({ text: 'Grade 4 Math', size: 32 })] }),
  new Paragraph('Unit 1: Place value & rounding'),
]);

documentTextExtractorContract('DocxTextExtractor', () => new DocxTextExtractor(), {
  bytes: guide,
  text: 'Grade 4 Math\nUnit 1: Place value & rounding',
});

describe('DocxTextExtractor', () => {
  it('joins the runs of a paragraph, keeps tabs and line breaks, and reads tables row by row', async () => {
    const docx = await makeDocx([
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun('Week 1'),
          new TextRun({ text: '\tFractions', font: 'Arial' }),
          new TextRun({ text: 'Equivalent fractions', break: 1 }),
        ],
      }),
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph('Unit')] }),
              new TableCell({ children: [new Paragraph('Weeks')] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph('Geometry')] }),
              new TableCell({ children: [new Paragraph('9–12 "angles" <lines>')] }),
            ],
          }),
        ],
      }),
    ]);

    const read = await new DocxTextExtractor().extract(docx);

    expect(read).toEqual({
      ok: true,
      value: {
        text: 'Week 1\tFractions\nEquivalent fractions\nUnit\tWeeks\nGeometry\t9–12 "angles" <lines>',
      },
    });
  });

  it('gives empty text for a document with no words', async () => {
    expect(await new DocxTextExtractor().extract(await makeDocx([new Paragraph('')]))).toEqual({
      ok: true,
      value: { text: '' },
    });
  });

  it('reports a ZIP that is not a Word document as unreadable', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'hi');
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    expect(await new DocxTextExtractor().extract(bytes)).toEqual({
      ok: false,
      error: { code: 'unreadable' },
    });
  });

  it('refuses a file over the size limit before reading it', async () => {
    expect(await new DocxTextExtractor({ maxBytes: 10 }).extract(guide)).toEqual({
      ok: false,
      error: { code: 'too_large' },
    });
  });
});
