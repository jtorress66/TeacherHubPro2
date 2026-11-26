import { err, ok, type ImageContentType, type Result } from '@thp/domain';
import type {
  DocumentText,
  DocumentTextError,
  DocumentTextExtractor,
  FileStore,
  FileStoreError,
  PdfText,
  PdfTextError,
  PdfTextExtractor,
  PictureCleaner,
  PictureCleanError,
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

/** Knows the text of a few documents by their bytes; anything else is unreadable. */
export class FakeDocumentTextExtractor implements DocumentTextExtractor {
  private readonly known: Map<string, string>;

  constructor(documents: readonly { readonly bytes: Uint8Array; readonly text: string }[]) {
    this.known = new Map(documents.map(({ bytes, text }) => [bytes.join(','), text]));
  }

  extract(bytes: Uint8Array): Promise<Result<DocumentText, DocumentTextError>> {
    const text = this.known.get(bytes.join(','));
    return Promise.resolve(text === undefined ? err({ code: 'unreadable' }) : ok({ text }));
  }
}

/** Knows how a few pictures look once cleaned, by their bytes; anything else is unreadable. */
export class FakePictureCleaner implements PictureCleaner {
  private readonly known: Map<string, Uint8Array>;
  readonly cleanedTypes: ImageContentType[] = [];

  constructor(pictures: readonly { readonly bytes: Uint8Array; readonly cleaned: Uint8Array }[]) {
    this.known = new Map(pictures.map(({ bytes, cleaned }) => [bytes.join(','), cleaned]));
  }

  clean(bytes: Uint8Array, type: ImageContentType): Promise<Result<Uint8Array, PictureCleanError>> {
    this.cleanedTypes.push(type);
    const cleaned = this.known.get(bytes.join(','));
    return Promise.resolve(cleaned === undefined ? err({ code: 'unreadable' }) : ok(cleaned));
  }
}
