import { err, ok, type Result } from '@thp/domain';
import type {
  FileStore,
  FileStoreError,
  PdfText,
  PdfTextError,
  PdfTextExtractor,
  StoredFile,
} from '@thp/ports';

export class InMemoryFileStore implements FileStore {
  private readonly files = new Map<string, StoredFile>();

  put(key: string, file: StoredFile): Promise<Result<true, FileStoreError>> {
    this.files.set(key, { bytes: file.bytes.slice(), contentType: file.contentType });
    return Promise.resolve(ok(true));
  }

  get(key: string): Promise<Result<StoredFile, FileStoreError>> {
    const file = this.files.get(key);
    return Promise.resolve(file === undefined ? err({ code: 'not_found' }) : ok(file));
  }

  delete(key: string): Promise<Result<true, FileStoreError>> {
    this.files.delete(key);
    return Promise.resolve(ok(true));
  }
}

export interface KnownPdf {
  readonly pdf: Uint8Array;
  readonly text: string;
  readonly pageCount: number;
}

/** Knows the text of a few PDFs by their bytes; anything else is unreadable. */
export class FakePdfTextExtractor implements PdfTextExtractor {
  private readonly known: Map<string, PdfText>;

  constructor(pdfs: readonly KnownPdf[]) {
    this.known = new Map(
      pdfs.map(({ pdf, text, pageCount }) => [pdf.join(','), { text, pageCount }]),
    );
  }

  extract(pdf: Uint8Array): Promise<Result<PdfText, PdfTextError>> {
    const text = this.known.get(pdf.join(','));
    return Promise.resolve(text === undefined ? err({ code: 'unreadable' }) : ok(text));
  }
}
