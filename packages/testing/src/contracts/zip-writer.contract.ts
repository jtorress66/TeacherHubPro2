import { describe, expect, it } from 'vitest';
import type { ZipWriter } from '@thp/ports';

/** Every ZipWriter: the files come back out with their names and exact text. */
export function zipWriterContract(
  name: string,
  make: () => ZipWriter,
  unzip: (bytes: Uint8Array) => Promise<Readonly<Record<string, string>>>,
): void {
  describe(`${name} (ZipWriter contract)`, () => {
    it('packs each file under its name with its exact text, accents and line breaks kept', async () => {
      const bytes = await make().zip([
        { name: 'students.csv', text: 'Name\r\nJosé Núñez\r\n' },
        { name: 'classes.csv', text: '\uFEFFClass,Teacher\r\n"Math, 5th",Ms. Lee\r\n' },
      ]);

      expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
      expect(await unzip(bytes)).toEqual({
        'students.csv': 'Name\r\nJosé Núñez\r\n',
        'classes.csv': '\uFEFFClass,Teacher\r\n"Math, 5th",Ms. Lee\r\n',
      });
    });

    it('makes a valid archive with no files', async () => {
      expect(await unzip(await make().zip([]))).toEqual({});
    });
  });
}
