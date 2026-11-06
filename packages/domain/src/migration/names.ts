/** A name as typed, for comparing: lower case, no accents or punctuation, single spaces. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface RosterName {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * The roster student a typed name belongs to: "First Last", "Last First" or "Last, First".
 * Only a single exact match counts; an unknown or ambiguous name matches nobody.
 */
export function matchTypedName(typed: string, roster: readonly RosterName[]): string | null {
  const name = normalizeName(typed);
  if (name === '') return null;
  const matches = roster.filter((student) => {
    const first = normalizeName(student.firstName);
    const last = normalizeName(student.lastName);
    return name === `${first} ${last}` || name === `${last} ${first}`;
  });
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}
