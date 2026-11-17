import { describe, expect, it } from 'vitest';
import { seededRandom } from '../games/random.ts';
import { makeGroups, maxNames, parseNames, pickName } from './group-maker.ts';

const names = Array.from({ length: 23 }, (_, i) => `Student ${String(i + 1)}`);

describe('parseNames', () => {
  it('reads one name per line or comma-separated, dropping blanks', () => {
    expect(parseNames('Ana\n  Ben , Cleo;\n\nDev\r\nEva  ')).toEqual([
      'Ana',
      'Ben',
      'Cleo',
      'Dev',
      'Eva',
    ]);
  });

  it(`keeps at most ${String(maxNames)} names`, () => {
    expect(
      parseNames(Array.from({ length: 250 }, (_, i) => `N${String(i)}`).join('\n')),
    ).toHaveLength(maxNames);
  });
});

describe('makeGroups', () => {
  it('splits into the number of groups asked for, sizes differing by at most one', () => {
    const groups = makeGroups(names, { by: 'count', value: 5 }, seededRandom(1));

    expect(groups).toHaveLength(5);
    const sizes = groups.map((group) => group.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(groups.flat().sort()).toEqual([...names].sort());
  });

  it('makes groups no bigger than the size asked for', () => {
    const groups = makeGroups(names, { by: 'size', value: 4 }, seededRandom(2));

    expect(groups).toHaveLength(6);
    expect(groups.every((group) => group.length <= 4 && group.length >= 3)).toBe(true);
    expect(groups.flat()).toHaveLength(23);
  });

  it('never makes empty groups or more groups than people', () => {
    expect(makeGroups(['Ana', 'Ben'], { by: 'count', value: 5 }, seededRandom(3))).toHaveLength(2);
    expect(makeGroups([], { by: 'count', value: 3 }, seededRandom(3))).toEqual([]);
    expect(makeGroups(names, { by: 'size', value: 0 }, seededRandom(3))).toEqual([]);
  });

  it('shuffles: another draw gives other groups', () => {
    const first = makeGroups(names, { by: 'count', value: 4 }, seededRandom(1));
    const second = makeGroups(names, { by: 'count', value: 4 }, seededRandom(99));
    expect(second).not.toEqual(first);
  });
});

describe('pickName', () => {
  it('picks one of the names, or none from an empty list', () => {
    expect(names).toContain(pickName(names, seededRandom(5)));
    expect(pickName([], seededRandom(5))).toBeNull();
  });
});
