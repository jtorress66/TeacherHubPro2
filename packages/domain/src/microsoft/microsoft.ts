import type { SchoolId, UserId } from '../shared/ids.ts';

/**
 * A teacher's link to their Microsoft account (OneDrive). Only the encrypted refresh token is
 * kept; when Microsoft issues a new one, the newest is saved.
 */
export interface MicrosoftConnection {
  /** One connection per teacher, so the teacher's id. */
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly encryptedRefreshToken: string;
  readonly connectedAt: Date;
}

export const connectMicrosoft = (input: Omit<MicrosoftConnection, 'id'>): MicrosoftConnection => ({
  id: input.teacherId,
  ...input,
});

/** File names are kept to 100 characters before the extension. */
export const maxOneDriveNameLength = 100;

/** OneDrive refuses " * : < > ? / \ | in file names. */
const forbidden = /["*:<>?/\\|]/g;
/** Control characters (U+0000 to U+001F, and DEL), built from their codes. */
const control = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);
const edges = /^[.\s]+|[.\s]+$/g;
/** Names Windows (and so OneDrive) keeps for devices. */
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Cuts between whole letters and emoji, at most `max` UTF-16 units, as JavaScript counts them. */
function cut(text: string, max: number): string {
  let kept = '';
  for (const { segment } of new Intl.Segmenter().segment(text)) {
    if (kept.length + segment.length > max) break;
    kept += segment;
  }
  return kept;
}

/**
 * A file name OneDrive accepts: trimmed, without the characters it forbids, never starting or
 * ending with a dot or a space, at most 100 characters before the extension, never a reserved
 * device name, never empty.
 */
export function oneDriveFileName(name: string, extension: string): string {
  const cleaned = name.replace(control, '').replace(forbidden, '').replace(/\s+/g, ' ');
  const base = cut(cleaned.replace(edges, ''), maxOneDriveNameLength).replace(edges, '');
  const named = base === '' ? 'TeacherHubPro' : base;
  return `${reserved.test(named) ? `${named} (TeacherHubPro)` : named}.${extension}`;
}
