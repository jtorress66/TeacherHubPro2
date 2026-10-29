import { describe, expect, it } from 'vitest';
import { toMigrationResult } from './migration-result.ts';

describe('toMigrationResult', () => {
  it('lists the migrations that ran successfully, in order', () => {
    expect(
      toMigrationResult({
        results: [
          { migrationName: '0001_initial', direction: 'Up', status: 'Success' },
          { migrationName: '0002_next', direction: 'Up', status: 'NotExecuted' },
        ],
      }),
    ).toEqual({ ok: true, value: { applied: ['0001_initial'] } });
  });

  it('reports nothing applied when there were no results', () => {
    expect(toMigrationResult({})).toEqual({ ok: true, value: { applied: [] } });
  });

  it('turns a failure into an error message', () => {
    expect(toMigrationResult({ error: new Error('relation exists') })).toEqual({
      ok: false,
      error: 'relation exists',
    });
    expect(toMigrationResult({ error: 'boom' })).toEqual({
      ok: false,
      error: 'Unknown migration error',
    });
  });
});
