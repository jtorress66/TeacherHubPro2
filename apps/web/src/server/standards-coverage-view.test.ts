import { describe, expect, it } from 'vitest';
import type { StandardCoverage } from '@thp/domain';
import { coverageFilter, filterCoverage } from './standards-coverage-view.ts';

const row = (code: string, status: StandardCoverage['status']) =>
  ({ standard: { code }, status }) as StandardCoverage;

describe('coverage filter', () => {
  it('reads a known status from the link and ignores anything else', () => {
    expect(coverageFilter('reteach')).toBe('reteach');
    expect(coverageFilter('not_tested')).toBe('not_tested');
    expect(coverageFilter('everything')).toBeNull();
    expect(coverageFilter(undefined)).toBeNull();
  });

  it('shows every row with no filter, or only the rows in the chosen status', () => {
    const rows = [row('A', 'watch'), row('B', 'reteach'), row('C', 'watch')];

    expect(filterCoverage(rows, null)).toEqual(rows);
    expect(filterCoverage(rows, 'watch').map((r) => r.standard.code)).toEqual(['A', 'C']);
    expect(filterCoverage(rows, 'on_track')).toEqual([]);
  });
});
