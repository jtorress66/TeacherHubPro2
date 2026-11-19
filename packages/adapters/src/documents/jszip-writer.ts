import JSZip from 'jszip';
import type { ZipEntry, ZipWriter } from '@thp/ports';

/** Packs text files (as UTF-8) into a compressed ZIP archive. */
export class JsZipWriter implements ZipWriter {
  async zip(entries: readonly ZipEntry[]): Promise<Uint8Array> {
    const zip = new JSZip();
    for (const entry of entries) zip.file(entry.name, entry.text);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }
}
