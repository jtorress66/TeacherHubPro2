import { describe, expect, it } from 'vitest';
import type { FileStore, PdfTextExtractor } from '@thp/ports';

const bytes = new Uint8Array([37, 80, 68, 70]);

export function fileStoreContract(name: string, make: () => FileStore): void {
  describe(`${name} (FileStore contract)`, () => {
    it('returns what was put', async () => {
      const store = make();
      await store.put('schools/a/logo.png', { bytes, contentType: 'image/png' });

      const file = await store.get('schools/a/logo.png');
      expect(file.ok && [Array.from(file.value.bytes), file.value.contentType]).toEqual([
        Array.from(bytes),
        'image/png',
      ]);
    });

    it('reports a missing key as not_found', async () => {
      expect(await make().get('nope')).toEqual({ ok: false, error: { code: 'not_found' } });
    });

    it('deletes, and deleting twice is harmless', async () => {
      const store = make();
      await store.put('k', { bytes, contentType: 'application/pdf' });

      expect((await store.delete('k')).ok).toBe(true);
      expect((await store.delete('k')).ok).toBe(true);
      expect((await store.get('k')).ok).toBe(false);
    });
  });
}

export interface PdfFixture {
  readonly pdf: Uint8Array;
  readonly text: string;
  readonly pageCount: number;
}

export function pdfTextExtractorContract(
  name: string,
  make: (known: PdfFixture) => PdfTextExtractor,
  known: PdfFixture,
): void {
  describe(`${name} (PdfTextExtractor contract)`, () => {
    it('extracts text and counts pages', async () => {
      expect(await make(known).extract(known.pdf)).toEqual({
        ok: true,
        value: { text: known.text, pageCount: known.pageCount },
      });
    });

    it('reports bytes that are not a readable PDF', async () => {
      expect(await make(known).extract(new Uint8Array([1, 2, 3]))).toEqual({
        ok: false,
        error: { code: 'unreadable' },
      });
    });
  });
}
