import type { SchoolId } from '../shared/ids.ts';
import { imageTypeOf } from '../shared/image-type.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

export const maxLogoBytes = 1024 * 1024;

export type LogoContentType = 'image/png' | 'image/jpeg';

const isLogoType = (type: string | null): type is LogoContentType =>
  type === 'image/png' || type === 'image/jpeg';

export function validateLogo(bytes: Uint8Array): Result<LogoContentType, ValidationError> {
  if (bytes.length === 0) return invalid('logo', 'required');
  if (bytes.length > maxLogoBytes) return invalid('logo', 'too_large');
  const type = imageTypeOf(bytes);
  return isLogoType(type) ? ok(type) : invalid('logo', 'invalid_format');
}

export const logoKeyFor = (schoolId: SchoolId): string => `schools/${schoolId}/logo`;
