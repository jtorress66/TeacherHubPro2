import { describe, expect, it } from 'vitest';
import { type SchoolId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { logoKeyFor, maxLogoBytes, validateLogo } from './school-logo.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe('validateLogo', () => {
  it('recognises PNG and JPEG by their first bytes, whatever the file says it is', () => {
    expect(valueOf(validateLogo(png))).toBe('image/png');
    expect(valueOf(validateLogo(jpeg))).toBe('image/jpeg');
  });

  it('refuses other files, an empty file and anything over 1 MB', () => {
    expect(errorOf(validateLogo(new TextEncoder().encode('<svg></svg>')))).toEqual({
      field: 'logo',
      code: 'invalid_format',
    });
    expect(errorOf(validateLogo(new Uint8Array()))).toEqual({ field: 'logo', code: 'required' });
    const big = new Uint8Array(maxLogoBytes + 1);
    big.set(png);
    expect(errorOf(validateLogo(big))).toEqual({ field: 'logo', code: 'too_large' });
    const limit = new Uint8Array(maxLogoBytes);
    limit.set(png);
    expect(valueOf(validateLogo(limit))).toBe('image/png');
  });
});

describe('logoKeyFor', () => {
  it('stores each school logo under the school', () => {
    expect(logoKeyFor('school-1' as SchoolId)).toBe('schools/school-1/logo');
  });
});
