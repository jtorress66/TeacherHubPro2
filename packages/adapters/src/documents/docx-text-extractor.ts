import JSZip from 'jszip';
import { err, maxAttachmentBytes, ok, type Result } from '@thp/domain';
import type { DocumentText, DocumentTextError, DocumentTextExtractor } from '@thp/ports';

/** The most XML the body may unpack to, so a small file cannot fill the memory. */
const maxXmlLength = 50_000_000;

const entities: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return entities[name] ?? whole;
  });
}

/**
 * The pieces of the body that carry text or layout: text runs, tabs and line breaks, and the ends
 * of paragraphs, table cells and table rows. Paragraph settings are removed first, because their
 * tab stops look like tabs.
 */
const token =
  /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>|<w:tc\b[^>]*>|<\/w:(p|tc|tr)>/gu;

function bodyText(xml: string): string {
  let text = '';
  let cells = 0;
  for (const match of xml.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/gu, '').matchAll(token)) {
    const [whole, runText, mark, end] = match;
    if (runText !== undefined) text += decode(runText);
    else if (mark !== undefined) text += mark === 'tab' ? '\t' : '\n';
    else if (end === 'p') text += cells > 0 ? ' ' : '\n';
    else if (end === 'tc') {
      text = `${text.trimEnd()}\t`;
      cells -= 1;
    } else if (end === 'tr') text = `${text.replace(/\t$/u, '')}\n`;
    else if (whole.startsWith('<w:tc')) cells += 1;
  }
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
    .join('\n');
}

/**
 * Reads the text of a Word (.docx) file: the main body's paragraphs in order, and tables one row
 * per line with tabs between cells. Headers, footers, comments and deleted text are left out.
 * Older .doc files are not ZIP archives, so they read as unreadable.
 */
export class DocxTextExtractor implements DocumentTextExtractor {
  private readonly maxBytes: number;

  constructor(options: { readonly maxBytes?: number } = {}) {
    this.maxBytes = options.maxBytes ?? maxAttachmentBytes;
  }

  async extract(bytes: Uint8Array): Promise<Result<DocumentText, DocumentTextError>> {
    if (bytes.length > this.maxBytes) return err({ code: 'too_large' });
    let xml: string | undefined;
    try {
      const zip = await JSZip.loadAsync(bytes);
      xml = await zip.file('word/document.xml')?.async('string');
    } catch {
      return err({ code: 'unreadable' });
    }
    if (xml === undefined) return err({ code: 'unreadable' });
    if (xml.length > maxXmlLength) return err({ code: 'too_large' });
    return ok({ text: bodyText(xml) });
  }
}
