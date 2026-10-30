import type { SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

export const maxLogoBytes = 1024 * 1024;

export type LogoContentType = 'image/png' | 'image/jpeg';

interface Signature {
  readonly type: LogoContentType;
  readonly bytes: readonly number[];
}

/** File signatures: the type comes from the bytes, never from the upload's name or header. */
const signatures: readonly Signature[] = [
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
];

export function validateLogo(bytes: Uint8Array): Result<LogoContentType, ValidationError> {
  if (bytes.length === 0) return invalid('logo', 'required');
  if (bytes.length > maxLogoBytes) return invalid('logo', 'too_large');
  const match = signatures.find((s) => s.bytes.every((byte, index) => bytes[index] === byte));
  return match ? ok(match.type) : invalid('logo', 'invalid_format');
}

export const logoKeyFor = (schoolId: SchoolId): string => `schools/${schoolId}/logo`;
