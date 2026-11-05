import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { maxAttachmentBytes } from './attachment.ts';

/** A teacher's Word document (.docx), to become a Google Doc in Classroom. */
export interface WordDocument {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** A .docx is a ZIP archive, so it starts with "PK". */
const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

/** Only a real .docx within the attachment limit; a renamed PDF is refused. */
export function parseWordDocument(
  name: string,
  bytes: Uint8Array,
): Result<WordDocument, ValidationError> {
  const trimmed = name.trim();
  if (!trimmed.toLowerCase().endsWith('.docx')) return invalid('file', 'not_allowed');
  if (bytes.length === 0) return invalid('file', 'required');
  if (bytes.length > maxAttachmentBytes) return invalid('file', 'too_large');
  if (!isZip(bytes)) return invalid('file', 'invalid_format');
  return ok({ name: trimmed, bytes });
}
