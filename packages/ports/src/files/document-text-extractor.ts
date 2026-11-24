import type { Result } from '@thp/domain';

export interface DocumentText {
  readonly text: string;
}

export interface DocumentTextError {
  readonly code: 'unreadable' | 'encrypted' | 'too_large';
}

/**
 * Reads the text of one kind of document (a PDF, a Word file). A `PdfTextExtractor` is one; a
 * use case that reads several kinds takes one extractor per kind.
 */
export interface DocumentTextExtractor {
  extract(bytes: Uint8Array): Promise<Result<DocumentText, DocumentTextError>>;
}
