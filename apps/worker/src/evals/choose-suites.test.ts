import { describe, expect, it } from 'vitest';
import { chooseSuites } from './choose-suites.ts';

const suites = [
  ['Lesson planner evals', 1],
  ['Grader evals', 2],
  ['Game writer evals', 3],
] as const;

describe('chooseSuites', () => {
  it('runs every suite when none is named', () => {
    expect(chooseSuites(suites, [])).toEqual(suites);
    expect(chooseSuites(suites, ['--', ''])).toEqual(suites);
  });

  it('runs only the suites whose title contains a named word, in any case', () => {
    expect(chooseSuites(suites, ['grader', 'GAME']).map(([title]) => title)).toEqual([
      'Grader evals',
      'Game writer evals',
    ]);
  });

  it('accepts names separated by commas or spaces in one argument', () => {
    expect(chooseSuites(suites, ['grader, game']).map(([title]) => title)).toEqual([
      'Grader evals',
      'Game writer evals',
    ]);
  });
});
