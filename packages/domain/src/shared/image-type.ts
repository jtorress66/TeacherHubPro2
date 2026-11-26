export type ImageContentType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

interface Signature {
  readonly type: ImageContentType;
  /** Bytes at the given offsets; `null` matches any byte. */
  readonly bytes: readonly (number | null)[];
}

const ascii = (text: string) => Array.from({ length: text.length }, (_, i) => text.charCodeAt(i));
const anyFour = [null, null, null, null];

/** File signatures: the type comes from the bytes, never from the upload's name or header. */
const signatures: readonly Signature[] = [
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/webp', bytes: [...ascii('RIFF'), ...anyFour, ...ascii('WEBP')] },
  { type: 'image/gif', bytes: ascii('GIF87a') },
  { type: 'image/gif', bytes: ascii('GIF89a') },
];

/** The picture type the bytes start with, or null for anything else. */
export function imageTypeOf(bytes: Uint8Array): ImageContentType | null {
  const match = signatures.find(
    (s) =>
      bytes.length >= s.bytes.length &&
      s.bytes.every((byte, index) => byte === null || bytes[index] === byte),
  );
  return match?.type ?? null;
}
