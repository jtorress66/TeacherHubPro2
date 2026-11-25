import { coverageStatuses, type CoverageStatus, type StandardCoverage } from '@thp/domain';

/** The status a coverage link asks for; anything else shows every standard. */
export const coverageFilter = (value: string | undefined): CoverageStatus | null =>
  coverageStatuses.find((status) => status === value) ?? null;

export const filterCoverage = (
  rows: readonly StandardCoverage[],
  status: CoverageStatus | null,
): readonly StandardCoverage[] =>
  status === null ? rows : rows.filter((row) => row.status === status);
