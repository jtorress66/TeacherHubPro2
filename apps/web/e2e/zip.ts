import { inflateRawSync } from 'node:zlib';

/**
 * The text files in a ZIP archive by name. Reads only what the school data download writes:
 * each file's local header (sizes filled in), stored or deflated.
 */
export function zipTexts(bytes: Buffer): Record<string, string> {
  const files: Record<string, string> = {};
  let at = 0;
  while (bytes.readUInt32LE(at) === 0x04034b50) {
    const method = bytes.readUInt16LE(at + 8);
    const size = bytes.readUInt32LE(at + 18);
    const nameLength = bytes.readUInt16LE(at + 26);
    const extraLength = bytes.readUInt16LE(at + 28);
    const name = bytes.toString('utf8', at + 30, at + 30 + nameLength);
    const start = at + 30 + nameLength + extraLength;
    const data = bytes.subarray(start, start + size);
    files[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    at = start + size;
  }
  return files;
}
