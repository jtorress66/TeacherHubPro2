/** Which rule a refused list of standards broke, as the page names it. */
export type StandardsProblem = 'tooLong' | 'tooMany';

const problems: Readonly<Record<string, StandardsProblem>> = {
  too_long: 'tooLong',
  out_of_range: 'tooMany',
};

const texts = (data: FormData, key: string): string[] =>
  data.getAll(key).filter((value): value is string => typeof value === 'string');

/**
 * The assignment's standards after the teacher's change: the ones it had, without a removed
 * one, then any typed or suggested codes. Repeats and spaces are tidied by the domain.
 */
export function nextStandards(data: FormData): string[] {
  const removed = new Set(texts(data, 'remove'));
  const kept = texts(data, 'standards').filter((code) => !removed.has(code));
  const added = texts(data, 'add').flatMap((value) => value.split(/[\s,;]+/u));
  return [...kept, ...added].filter((code) => code !== '');
}

export const standardsProblem = (code: string | undefined): StandardsProblem | null =>
  code === undefined ? null : (problems[code] ?? null);
