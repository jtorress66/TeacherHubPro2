import type { Result } from '@thp/domain';

export interface PdfText {
  readonly text: string;
  readonly pageCount: number;
}

export interface PdfTextError {
  readonly code: 'unreadable' | 'encrypted' | 'too_large';
}

export interface PdfTextExtractor {
  extract(pdf: Uint8Array): Promise<Result<PdfText, PdfTextError>>;
}
