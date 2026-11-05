import { describe, expect, it } from 'vitest';
import { maxAttachmentBytes } from './attachment.ts';
import { parseWordDocument } from './word-document.ts';

const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

describe('parseWordDocument', () => {
  it('accepts a .docx file, keeping its trimmed name', () => {
    expect(parseWordDocument(' Unit 3 Test.DOCX ', docx)).toEqual({
      ok: true,
      value: { name: 'Unit 3 Test.DOCX', bytes: docx },
    });
  });

  it('refuses another kind of file, even when renamed', () => {
    expect(parseWordDocument('test.pdf', docx)).toEqual({
      ok: false,
      error: { field: 'file', code: 'not_allowed' },
    });
    const pdf = new TextEncoder().encode('%PDF-1.7');
    expect(parseWordDocument('test.docx', pdf)).toEqual({
      ok: false,
      error: { field: 'file', code: 'invalid_format' },
    });
  });

  it('refuses an empty or too large file', () => {
    expect(parseWordDocument('test.docx', new Uint8Array())).toEqual({
      ok: false,
      error: { field: 'file', code: 'required' },
    });
    const big = new Uint8Array(maxAttachmentBytes + 1);
    big.set([0x50, 0x4b]);
    expect(parseWordDocument('test.docx', big)).toEqual({
      ok: false,
      error: { field: 'file', code: 'too_large' },
    });
  });
});
