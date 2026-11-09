/**
 * The eval suites to run: all of them, or only those whose title contains one of the named words
 * (`pnpm eval -- grader game`), so a rerun calls Claude, and costs money, only where needed.
 */
export function chooseSuites<T extends readonly [string, ...unknown[]]>(
  suites: readonly T[],
  args: readonly string[],
): readonly T[] {
  const names = args
    .flatMap((arg) => arg.split(/[\s,]+/))
    .map((name) => name.trim().toLowerCase())
    .filter((name) => /\p{L}/u.test(name));
  if (names.length === 0) return suites;
  return suites.filter(([title]) => names.some((name) => title.toLowerCase().includes(name)));
}
