import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { MarkdownBlock, MarkdownInline } from '@thp/domain';
import type { DocumentFileWriter } from '@thp/ports';

/** A blank to write in, as a printed worksheet shows it. */
const blank = '__________';

function runs(
  inline: readonly MarkdownInline[],
  style: { readonly bold?: boolean; readonly italics?: boolean } = {},
): TextRun[] {
  return inline.flatMap((part) => {
    switch (part.kind) {
      case 'text':
        return [new TextRun({ text: part.text, ...style })];
      case 'blank':
        return [new TextRun({ text: blank, ...style })];
      case 'strong':
        return runs(part.children, { ...style, bold: true });
      case 'em':
        return runs(part.children, { ...style, italics: true });
    }
  });
}

const headings = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function cell(content: readonly MarkdownInline[], bold: boolean): TableCell {
  return new TableCell({ children: [new Paragraph({ children: runs(content, { bold }) })] });
}

function blockParts(block: MarkdownBlock): (Paragraph | Table)[] {
  switch (block.kind) {
    case 'heading':
      return [new Paragraph({ heading: headings[block.level], children: runs(block.content) })];
    case 'paragraph':
      return [
        new Paragraph({
          children: block.lines.flatMap((line, index) =>
            index === 0 ? runs(line) : [new TextRun({ break: 1 }), ...runs(line)],
          ),
        }),
      ];
    case 'rule':
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } },
        }),
      ];
    case 'list':
      return block.items.map((item, index) =>
        block.ordered
          ? new Paragraph({ children: [new TextRun(`${String(block.start + index)}. `), ...runs(item)] })
          : new Paragraph({ bullet: { level: 0 }, children: runs(item) }),
      );
    case 'table':
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            ...(block.header === null
              ? []
              : [new TableRow({ children: block.header.map((c) => cell(c, true)) })]),
            ...block.rows.map((row) => new TableRow({ children: row.map((c) => cell(c, false)) })),
          ],
        }),
      ];
  }
}

/** Word documents through the docx library: headings, lists, tables, bold, italics and blanks. */
export class DocxDocumentWriter implements DocumentFileWriter {
  async docx(document: {
    readonly title: string;
    readonly blocks: readonly MarkdownBlock[];
  }): Promise<Uint8Array> {
    const file = new Document({
      title: document.title,
      sections: [{ children: document.blocks.flatMap(blockParts) }],
    });
    return new Uint8Array(await Packer.toBuffer(file));
  }
}
