import type { Student } from '@thp/domain';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** Roster order: by last name, then first name, ignoring case and accents. */
export const byName = (a: Student, b: Student): number =>
  collator.compare(a.lastName, b.lastName) || collator.compare(a.firstName, b.firstName);
