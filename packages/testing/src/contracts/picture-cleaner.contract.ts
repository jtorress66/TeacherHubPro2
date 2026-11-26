import { describe, expect, it } from 'vitest';
import type { ImageContentType } from '@thp/domain';
import type { PictureCleaner } from '@thp/ports';

const ascii = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/** Where the photo was taken, as a camera writes it: what must never be kept. */
const gps = ascii('GPS 18.0111N 66.6141W');

const jpegSegment = (marker: number, data: readonly number[]) => [
  0xff,
  marker,
  ...be16(data.length + 2),
  ...data,
];
const jpegStart = [0xff, 0xd8];
const jfif = jpegSegment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const quantTable = jpegSegment(0xdb, [0, ...Array.from({ length: 8 }, (_, i) => i + 1)]);
const scan = [...jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd9];

const pngChunk = (type: string, data: readonly number[]) => [
  ...be32(data.length),
  ...ascii(type),
  ...data,
  0,
  0,
  0,
  0,
];
const pngStart = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const header = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const pixels = pngChunk('IDAT', [0x78, 0x9c, 0x62, 0x00]);
const end = pngChunk('IEND', []);

const webpChunk = (type: string, data: readonly number[]) => [
  ...ascii(type),
  ...le32(data.length),
  ...data,
  ...(data.length % 2 === 1 ? [0] : []),
];
const riff = (chunks: readonly number[]) => [
  ...ascii('RIFF'),
  ...le32(chunks.length + 4),
  ...ascii('WEBP'),
  ...chunks,
];
/** VP8X with the EXIF (0x08) and XMP (0x04) flags set; the canvas is 1×1. */
const vp8x = (flags: number) => webpChunk('VP8X', [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const frame = webpChunk('VP8L', [0x2f, 0, 0, 0, 0x10, 0x07]);

export interface PictureSample {
  readonly name: string;
  readonly type: ImageContentType;
  readonly bytes: Uint8Array;
  readonly cleaned: Uint8Array;
}

/** Small pictures with location and other extras hidden in them, and what must be left. */
export const pictureSamples: readonly PictureSample[] = [
  {
    name: 'a JPEG with EXIF, a Photoshop block and a comment',
    type: 'image/jpeg',
    bytes: new Uint8Array([
      ...jpegStart,
      ...jfif,
      ...jpegSegment(0xe1, [...ascii('Exif'), 0, 0, ...gps]),
      ...jpegSegment(0xed, [...ascii('Photoshop 3.0'), 0, ...gps]),
      ...jpegSegment(0xfe, gps),
      ...quantTable,
      ...scan,
    ]),
    cleaned: new Uint8Array([...jpegStart, ...jfif, ...quantTable, ...scan]),
  },
  {
    name: 'a PNG with EXIF, text and a timestamp',
    type: 'image/png',
    bytes: new Uint8Array([
      ...pngStart,
      ...header,
      ...pngChunk('eXIf', gps),
      ...pngChunk('tEXt', [...ascii('Comment'), 0, ...gps]),
      ...pngChunk('iTXt', [...ascii('XML'), 0, 0, 0, 0, 0, ...gps]),
      ...pngChunk('tIME', [7, 234, 11, 25, 12, 0, 0]),
      ...pixels,
      ...end,
    ]),
    cleaned: new Uint8Array([...pngStart, ...header, ...pixels, ...end]),
  },
  {
    name: 'a WebP with EXIF and XMP',
    type: 'image/webp',
    bytes: new Uint8Array(
      riff([...vp8x(0x0c), ...frame, ...webpChunk('EXIF', gps), ...webpChunk('XMP ', gps)]),
    ),
    cleaned: new Uint8Array(riff([...vp8x(0x00), ...frame])),
  },
  {
    name: 'a GIF, which has nowhere to keep a location',
    type: 'image/gif',
    bytes: new Uint8Array([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b]),
    cleaned: new Uint8Array([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b]),
  },
];

const contains = (bytes: Uint8Array, part: readonly number[]) =>
  bytes.some((_, start) => part.every((byte, offset) => bytes[start + offset] === byte));

/** Every PictureCleaner: the extras go, the picture itself stays byte for byte. */
export function pictureCleanerContract(
  name: string,
  make: (samples: readonly PictureSample[]) => PictureCleaner,
): void {
  describe(`${name} (PictureCleaner contract)`, () => {
    for (const sample of pictureSamples) {
      it(`keeps only the picture in ${sample.name}`, async () => {
        const cleaned = await make(pictureSamples).clean(sample.bytes, sample.type);

        expect(cleaned.ok && Array.from(cleaned.value)).toEqual(Array.from(sample.cleaned));
        expect(cleaned.ok && contains(cleaned.value, gps)).toBe(false);
      });
    }

    it('refuses a picture cut off part way through', async () => {
      const [jpeg] = pictureSamples;
      const cut = jpeg?.bytes.slice(0, 12) ?? new Uint8Array();

      expect(await make(pictureSamples).clean(cut, 'image/jpeg')).toEqual({
        ok: false,
        error: { code: 'unreadable' },
      });
    });
  });
}
