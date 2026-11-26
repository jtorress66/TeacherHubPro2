import type { SchoolId } from '../shared/ids.ts';
import { imageTypeOf, type ImageContentType } from '../shared/image-type.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

/** A picture the teacher put on a game item, and the description read to students who can't see it. */
export interface GamePicture {
  readonly id: string;
  readonly alt: string;
}

export const maxPictureBytes = 2 * 1024 * 1024;
export const maxPictureAltLength = 200;

const pictureIdPattern = /^[A-Za-z0-9_-]{1,64}$/u;

export const isPictureId = (value: string): boolean => pictureIdPattern.test(value);

/** The picture's type, read from its bytes; only PNG, JPEG, WebP and GIF up to 2 MB. */
export function validatePictureFile(bytes: Uint8Array): Result<ImageContentType, ValidationError> {
  if (bytes.length === 0) return invalid('picture', 'required');
  if (bytes.length > maxPictureBytes) return invalid('picture', 'too_large');
  const type = imageTypeOf(bytes);
  return type === null ? invalid('picture', 'invalid_format') : ok(type);
}

/** An item's picture, if it has one: a safe id and a required, short description. */
export function checkPicture(
  field: string,
  picture: GamePicture | undefined,
): Result<GamePicture | undefined, ValidationError> {
  if (picture === undefined) return ok(undefined);
  if (!isPictureId(picture.id)) return invalid(`${field}.picture`, 'invalid_format');
  const alt = requiredText(`${field}.picture.alt`, picture.alt, maxPictureAltLength);
  return alt.ok ? ok({ id: picture.id, alt: alt.value }) : alt;
}

/** Keys start with the school, so a school's deletion removes its pictures with its other files. */
export const pictureKeyFor = (schoolId: SchoolId, pictureId: string): string =>
  `game-pictures/${schoolId}/${pictureId}`;
