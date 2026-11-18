import JSZip from 'jszip';
import { zipWriterContract } from '@thp/testing';
import { JsZipWriter } from '../src/documents/jszip-writer.ts';

async function unzip(bytes: Uint8Array): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files).filter((file) => !file.dir);
  const texts = await Promise.all(files.map((file) => file.async('string')));
  return Object.fromEntries(files.map((file, i) => [file.name, texts[i] ?? '']));
}

zipWriterContract('JsZipWriter', () => new JsZipWriter(), unzip);
