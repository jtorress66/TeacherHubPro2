import { randomInt, shuffle, type Random } from '../games/random.ts';

/** The most names the free group maker takes at once. */
export const maxNames = 200;

/** Names pasted one per line, or separated by commas or semicolons. */
export const parseNames = (text: string): string[] =>
  text
    .split(/[\n\r,;]+/)
    .map((name) => name.trim())
    .filter((name) => name !== '')
    .slice(0, maxNames);

export type GroupRequest =
  | { readonly by: 'count'; readonly value: number }
  | { readonly by: 'size'; readonly value: number };

/**
 * Random groups: a fair shuffle dealt out in turn, so group sizes differ by at most one. Never
 * more groups than people, and no empty groups.
 */
export function makeGroups(
  names: readonly string[],
  request: GroupRequest,
  random: Random,
): string[][] {
  const value = Math.floor(request.value);
  if (names.length === 0 || !(value >= 1)) return [];
  const count = Math.min(
    names.length,
    request.by === 'count' ? value : Math.ceil(names.length / value),
  );
  const groups: string[][] = Array.from({ length: count }, () => []);
  shuffle(names, random).forEach((name, index) => groups[index % count]?.push(name));
  return groups;
}

/** One name at random, for "who answers next?". */
export const pickName = (names: readonly string[], random: Random): string | null =>
  names[randomInt(random, names.length)] ?? null;
