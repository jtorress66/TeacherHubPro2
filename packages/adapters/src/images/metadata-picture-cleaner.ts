import { err, ok, type ImageContentType, type Result } from '@thp/domain';
import type { PictureCleaner, PictureCleanError } from '@thp/ports';

type Cleaned = Uint8Array | null;

const joined = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const fourcc = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(...bytes.subarray(at, at + 4));

/**
 * JPEG segments that only carry extras: APP1 (EXIF, XMP, where GPS lives), APP12, APP13
 * (Photoshop and IPTC) and comments. JFIF, colour profiles and Adobe colour hints are kept.
 */
const jpegExtras = new Set([0xe1, 0xec, 0xed, 0xfe]);
/** Markers that stand alone, with no length after them. */
const standalone = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
const startOfScan = 0xda;
const endOfImage = 0xd9;

function cleanJpeg(bytes: Uint8Array): Cleaned {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === undefined) return null;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === endOfImage) return joined([...parts, bytes.subarray(at, at + 2)]);
    if (standalone(marker)) {
      parts.push(bytes.subarray(at, at + 2));
      at += 2;
      continue;
    }
    const high = bytes[at + 2];
    const low = bytes[at + 3];
    if (high === undefined || low === undefined) return null;
    const next = at + 2 + ((high << 8) | low);
    if (next > bytes.length) return null;
    // After the start of scan comes the picture itself, kept exactly as it is.
    if (marker === startOfScan) return joined([...parts, bytes.subarray(at)]);
    if (!jpegExtras.has(marker)) parts.push(bytes.subarray(at, next));
    at = next;
  }
  return null;
}

/** PNG chunks for EXIF, text of any kind and the time the file was made. */
const pngExtras = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function cleanPng(bytes: Uint8Array): Cleaned {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= bytes.length) {
    const type = fourcc(bytes, at + 4);
    const next = at + 12 + view.getUint32(at);
    if (next > bytes.length) return null;
    if (!pngExtras.has(type)) parts.push(bytes.subarray(at, next));
    if (type === 'IEND') return joined(parts);
    at = next;
  }
  return null;
}

const webpExtras = new Set(['EXIF', 'XMP ']);
/** VP8X flag bits that announce EXIF and XMP chunks. */
const webpExtraFlags = 0x08 | 0x04;

function cleanWebp(bytes: Uint8Array): Cleaned {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const type = fourcc(bytes, at);
    const size = view.getUint32(at + 4, true);
    const next = at + 8 + size + (size % 2);
    if (next > bytes.length) return null;
    if (!webpExtras.has(type)) {
      const chunk = bytes.slice(at, next);
      if (type === 'VP8X' && chunk.length > 8) chunk[8] = (chunk[8] ?? 0) & ~webpExtraFlags;
      parts.push(chunk);
    }
    at = next;
  }
  if (at !== bytes.length || parts.length === 0) return null;
  const body = joined(parts);
  const head = bytes.slice(0, 12);
  new DataView(head.buffer).setUint32(4, body.length + 4, true);
  return joined([head, body]);
}

const cleaners: Readonly<Record<ImageContentType, (bytes: Uint8Array) => Cleaned>> = {
  'image/jpeg': cleanJpeg,
  'image/png': cleanPng,
  'image/webp': cleanWebp,
  // GIF has no place for a camera's location; its frames are kept as they are.
  'image/gif': (bytes) => bytes,
};

/**
 * Removes camera details, GPS location, comments and timestamps from uploaded pictures by
 * walking the file's own blocks; the picture data is copied byte for byte, never re-encoded.
 */
export class MetadataPictureCleaner implements PictureCleaner {
  clean(bytes: Uint8Array, type: ImageContentType): Promise<Result<Uint8Array, PictureCleanError>> {
    const cleaned = cleaners[type](bytes);
    return Promise.resolve(cleaned === null ? err({ code: 'unreadable' }) : ok(cleaned));
  }
}
