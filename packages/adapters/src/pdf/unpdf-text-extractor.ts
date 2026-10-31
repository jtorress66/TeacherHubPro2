import { extractText, getDocumentProxy } from 'unpdf';
import { err, maxAttachmentBytes, ok, type Result } from '@thp/domain';
import type { PdfText, PdfTextError, PdfTextExtractor } from '@thp/ports';

/**
 * Reads the text of a PDF (every page, in order) with unpdf, a build of Mozilla's PDF.js. A scan
 * has no text, so it gives empty text; reading it would need OCR.
 */
export class UnpdfTextExtractor implements PdfTextExtractor {
  private readonly maxBytes: number;

  constructor(options: { readonly maxBytes?: number } = {}) {
    this.maxBytes = options.maxBytes ?? maxAttachmentBytes;
  }

  async extract(pdf: Uint8Array): Promise<Result<PdfText, PdfTextError>> {
    if (pdf.length > this.maxBytes) return err({ code: 'too_large' });
    try {
      // PDF.js takes ownership of the buffer it is given, so it reads a copy.
      const document = await getDocumentProxy(pdf.slice());
      const { totalPages, text } = await extractText(document, { mergePages: false });
      const pages = text.map((page) => page.trim()).filter((page) => page !== '');
      return ok({ text: pages.join('\n'), pageCount: totalPages });
    } catch (error) {
      return err({
        code:
          error instanceof Error && error.name === 'PasswordException' ? 'encrypted' : 'unreadable',
      });
    }
  }
}
