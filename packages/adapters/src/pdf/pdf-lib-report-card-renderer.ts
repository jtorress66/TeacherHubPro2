import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type {
  DocumentFact,
  ReportCardPage,
  ReportCardRenderer,
  ReportCardSection,
  StoredFile,
} from '@thp/ports';
import { printable } from './printable.ts';

const pageSize: [number, number] = [612, 792]; // US Letter, in points
const margin = 54;
const contentWidth = pageSize[0] - margin * 2;
const ink = rgb(0.12, 0.14, 0.18);
const muted = rgb(0.4, 0.43, 0.48);
const rule = rgb(0.8, 0.82, 0.86);
const band = rgb(0.94, 0.95, 0.97);

interface Fonts {
  readonly regular: PDFFont;
  readonly bold: PDFFont;
}

/** Draws downwards from the top margin, starting a continuation page when one fills up. */
class Cursor {
  private page: PDFPage;
  private y: number;

  constructor(
    private readonly doc: PDFDocument,
    readonly fonts: Fonts,
  ) {
    this.page = doc.addPage(pageSize);
    this.y = pageSize[1] - margin;
  }

  /** Makes room for `height` points, moving to a new page if needed. */
  reserve(height: number): void {
    if (this.y - height >= margin) return;
    this.page = this.doc.addPage(pageSize);
    this.y = pageSize[1] - margin;
  }

  gap(points: number): void {
    this.y -= points;
  }

  text(
    value: string,
    options: { x?: number; size?: number; bold?: boolean; color?: typeof ink; maxWidth?: number },
  ): void {
    const size = options.size ?? 10;
    const font = options.bold === true ? this.fonts.bold : this.fonts.regular;
    const maxWidth = options.maxWidth ?? contentWidth;
    for (const line of wrap(printable(value), font, size, maxWidth)) {
      this.reserve(size + 4);
      this.y -= size;
      this.page.drawText(line, {
        x: margin + (options.x ?? 0),
        y: this.y,
        size,
        font,
        color: options.color ?? ink,
      });
      this.y -= 4;
    }
  }

  /** One row of cells at fixed column offsets; the row is as tall as its tallest cell. */
  row(
    cells: readonly string[],
    widths: readonly number[],
    options: { bold?: boolean; fill?: boolean },
  ): void {
    const size = 9;
    const font = options.bold === true ? this.fonts.bold : this.fonts.regular;
    const lines = cells.map((cell, i) => wrap(printable(cell), font, size, (widths[i] ?? 0) - 8));
    const height = Math.max(1, ...lines.map((l) => l.length)) * (size + 3) + 6;
    this.reserve(height);
    if (options.fill === true) {
      this.page.drawRectangle({
        x: margin,
        y: this.y - height,
        width: contentWidth,
        height,
        color: band,
      });
    }
    let x = margin;
    lines.forEach((cellLines, i) => {
      cellLines.forEach((line, n) => {
        this.page.drawText(line, {
          x: x + 4,
          y: this.y - 3 - (n + 1) * (size + 3) + 3,
          size,
          font,
          color: ink,
        });
      });
      x += widths[i] ?? 0;
    });
    this.y -= height;
    this.line(rule);
  }

  line(color: typeof ink, from = 0, width = contentWidth): void {
    this.page.drawLine({
      start: { x: margin + from, y: this.y },
      end: { x: margin + from + width, y: this.y },
      thickness: 0.5,
      color,
    });
  }

  image(image: PDFImage, maxHeight: number): number {
    const scale = Math.min(maxHeight / image.height, 120 / image.width);
    const width = image.width * scale;
    const height = image.height * scale;
    this.page.drawImage(image, { x: margin, y: this.y - height, width, height });
    return width;
  }
}

/** Splits text into lines that fit `maxWidth`, breaking at spaces (or inside very long words). */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth;
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current !== '') lines.push(current);
    current = word;
    while (!fits(current) && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && !fits(current.slice(0, cut))) cut -= 1;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  lines.push(current);
  return lines;
}

type Drawer<K extends ReportCardSection['kind']> = (
  cursor: Cursor,
  section: Extract<ReportCardSection, { kind: K }>,
) => void;

const drawFacts: Drawer<'facts'> = (cursor, { items }) => {
  const half = contentWidth / 2;
  const pairs: DocumentFact[][] = [];
  for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2));
  for (const pair of pairs) {
    cursor.reserve(16);
    pair.forEach((fact, column) => {
      if (column === 1) cursor.gap(-14);
      cursor.text(`${fact.label}: ${fact.value}`, {
        x: column * half,
        size: 10,
        maxWidth: half - 8,
      });
    });
  }
};

const drawTable: Drawer<'table'> = (cursor, { title, headers, rows, empty }) => {
  cursor.text(title, { size: 12, bold: true });
  cursor.gap(2);
  const first = headers.length > 1 ? contentWidth * 0.4 : contentWidth;
  const rest = headers.length > 1 ? (contentWidth - first) / (headers.length - 1) : 0;
  const widths = headers.map((_, i) => (i === 0 ? first : rest));
  cursor.row(headers, widths, { bold: true, fill: true });
  if (rows.length === 0) cursor.text(empty, { size: 9, color: muted });
  for (const cells of rows) cursor.row(cells, widths, {});
};

const drawText: Drawer<'text'> = (cursor, { title, text }) => {
  cursor.text(title, { size: 12, bold: true });
  cursor.text(text, { size: 10 });
};

const drawSignatures: Drawer<'signatures'> = (cursor, { labels }) => {
  const slot = contentWidth / Math.max(1, labels.length);
  cursor.reserve(48);
  cursor.gap(32);
  labels.forEach((_, i) => {
    cursor.line(ink, i * slot + 8, slot - 16);
  });
  cursor.gap(2);
  labels.forEach((label, i) => {
    if (i > 0) cursor.gap(-12); // back up one line: the labels share a row
    cursor.text(label, { x: i * slot + 8, size: 8, color: muted, maxWidth: slot - 16 });
  });
};

/** One drawer per kind of section; a new kind means a new drawer here, not a branch elsewhere. */
const drawers: { readonly [K in ReportCardSection['kind']]: Drawer<K> } = {
  facts: drawFacts,
  table: drawTable,
  text: drawText,
  signatures: drawSignatures,
};

function draw(cursor: Cursor, section: ReportCardSection): void {
  drawers[section.kind](cursor, section as never);
}

async function embedLogo(doc: PDFDocument, logo: StoredFile | null): Promise<PDFImage | null> {
  if (logo === null) return null;
  try {
    return logo.contentType === 'image/png'
      ? await doc.embedPng(logo.bytes)
      : await doc.embedJpg(logo.bytes);
  } catch {
    return null; // An unreadable logo should not stop the report card.
  }
}

async function drawCard(doc: PDFDocument, fonts: Fonts, card: ReportCardPage): Promise<void> {
  const cursor = new Cursor(doc, fonts);
  const logo = await embedLogo(doc, card.logo);
  const offset = logo === null ? 0 : cursor.image(logo, 56) + 12;
  cursor.text(card.schoolName, {
    x: offset,
    size: 16,
    bold: true,
    maxWidth: contentWidth - offset,
  });
  if (card.schoolDetails !== null) {
    cursor.text(card.schoolDetails, {
      x: offset,
      size: 9,
      color: muted,
      maxWidth: contentWidth - offset,
    });
  }
  if (logo !== null) cursor.gap(Math.max(0, 30 - (card.schoolDetails === null ? 0 : 13)));
  cursor.gap(8);
  cursor.line(rule);
  cursor.gap(10);
  cursor.text(card.title, { size: 18, bold: true });
  cursor.gap(6);
  for (const section of card.sections) {
    draw(cursor, section);
    cursor.gap(12);
  }
}

/** Report cards as a US Letter PDF with the standard Helvetica font, one card per page. */
export class PdfLibReportCardRenderer implements ReportCardRenderer {
  async render(pages: readonly [ReportCardPage, ...ReportCardPage[]]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    for (const card of pages) await drawCard(doc, fonts, card);
    return doc.save({ useObjectStreams: false });
  }
}
