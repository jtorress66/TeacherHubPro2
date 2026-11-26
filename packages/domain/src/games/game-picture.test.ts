import { describe, expect, it } from 'vitest';
import type { SchoolId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  checkPicture,
  maxPictureAltLength,
  maxPictureBytes,
  pictureKeyFor,
  validatePictureFile,
} from './game-picture.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe('validatePictureFile', () => {
  it('takes PNG, JPEG, WebP and GIF pictures by their bytes', () => {
    expect(valueOf(validatePictureFile(png))).toBe('image/png');
    expect(valueOf(validatePictureFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])))).toBe(
      'image/jpeg',
    );
  });

  it('refuses other files, an empty file and anything over 2 MB', () => {
    expect(errorOf(validatePictureFile(new TextEncoder().encode('<svg/>')))).toEqual({
      field: 'picture',
      code: 'invalid_format',
    });
    expect(errorOf(validatePictureFile(new Uint8Array()))).toEqual({
      field: 'picture',
      code: 'required',
    });
    const big = new Uint8Array(maxPictureBytes + 1);
    big.set(png);
    expect(errorOf(validatePictureFile(big))).toEqual({ field: 'picture', code: 'too_large' });
    const limit = new Uint8Array(maxPictureBytes);
    limit.set(png);
    expect(valueOf(validatePictureFile(limit))).toBe('image/png');
  });
});

describe('checkPicture', () => {
  it('needs a description for every picture, so screen readers can say what it shows', () => {
    expect(errorOf(checkPicture('items.0', { id: 'pic-1', alt: '  ' }))).toEqual({
      field: 'items.0.picture.alt',
      code: 'required',
    });
    expect(
      errorOf(checkPicture('items.0', { id: 'pic-1', alt: 'x'.repeat(maxPictureAltLength + 1) })),
    ).toEqual({ field: 'items.0.picture.alt', code: 'too_long' });
  });

  it('trims the description and keeps the picture', () => {
    expect(valueOf(checkPicture('items.0', { id: 'pic-1', alt: ' A map of Ponce ' }))).toEqual({
      id: 'pic-1',
      alt: 'A map of Ponce',
    });
  });

  it('refuses a picture whose id could reach outside the game pictures', () => {
    expect(errorOf(checkPicture('items.0', { id: '../logo', alt: 'Logo' }))).toEqual({
      field: 'items.0.picture',
      code: 'invalid_format',
    });
  });

  it('has nothing to check when the item has no picture', () => {
    expect(valueOf(checkPicture('items.0', undefined))).toBeUndefined();
  });
});

describe('pictureKeyFor', () => {
  it('stores each picture under its school, so deleting the school deletes it', () => {
    expect(pictureKeyFor('school-1' as SchoolId, 'pic-1')).toBe('game-pictures/school-1/pic-1');
  });
});
