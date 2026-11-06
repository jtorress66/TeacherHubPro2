import { describe, expect, it } from 'vitest';
import { formatReport, MigrationTally } from './legacy-report.ts';
import { matchTypedName, normalizeName } from './names.ts';

describe('MigrationTally', () => {
  it('counts read, imported and skipped records per collection, in the order first seen', () => {
    const tally = new MigrationTally();
    tally.read('users', 3);
    tally.read('schools', 1);
    tally.imported('users');
    tally.imported('users');
    tally.skipped('users', 'invalid_email');
    tally.imported('schools');
    tally.noted('schools', 'logo_dropped');
    tally.noted('schools', 'logo_dropped');

    expect(tally.report().collections).toEqual([
      { collection: 'users', read: 3, imported: 2, skipped: { invalid_email: 1 }, notes: {} },
      { collection: 'schools', read: 1, imported: 1, skipped: {}, notes: { logo_dropped: 2 } },
    ]);
  });

  it('leaves out a whole collection with one reason', () => {
    const tally = new MigrationTally();
    tally.leftOut('user_sessions', 40, 'transient');

    expect(tally.report().collections).toEqual([
      { collection: 'user_sessions', read: 40, imported: 0, skipped: { transient: 40 }, notes: {} },
    ]);
  });

  it('finds a collection whose counts do not add up', () => {
    const tally = new MigrationTally();
    tally.read('grades', 2);
    tally.imported('grades');
    expect(tally.report().unaccounted).toEqual(['grades']);
    tally.skipped('grades', 'student_not_found');
    expect(tally.report().unaccounted).toEqual([]);
  });
});

describe('formatReport', () => {
  it('prints counts and reasons only, one collection per line', () => {
    const tally = new MigrationTally();
    tally.read('students', 3);
    tally.imported('students', 2);
    tally.skipped('students', 'class_not_found');
    tally.noted('students', 'copied_to_other_class');

    expect(formatReport(tally.report())).toEqual([
      'students: read 3, imported 2, skipped 1',
      '  skipped: class_not_found 1',
      '  note: copied_to_other_class 1',
    ]);
  });

  it('warns about a collection whose counts do not add up', () => {
    const tally = new MigrationTally();
    tally.read('grades', 1);
    expect(formatReport(tally.report())).toEqual([
      'grades: read 1, imported 0, skipped 0',
      'Counts do not add up for: grades',
    ]);
  });
});

describe('normalizeName', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    expect(normalizeName('  José   ÁLVAREZ-Núñez ')).toBe('jose alvarez nunez');
  });
});

describe('matchTypedName', () => {
  const roster = [
    { id: 's1', firstName: 'José', lastName: 'Álvarez' },
    { id: 's2', firstName: 'Ana', lastName: 'Rivera' },
    { id: 's3', firstName: 'Luis', lastName: 'Ortiz' },
    { id: 's4', firstName: 'Luis', lastName: 'Ortiz' },
  ];

  it('matches "First Last", "Last First" and "Last, First" to the one roster student', () => {
    expect(matchTypedName('jose alvarez', roster)).toBe('s1');
    expect(matchTypedName('Rivera Ana', roster)).toBe('s2');
    expect(matchTypedName('Rivera, Ana', roster)).toBe('s2');
  });

  it('never guesses: an unknown or ambiguous name matches nobody', () => {
    expect(matchTypedName('Ana', roster)).toBeNull();
    expect(matchTypedName('Pedro Rivera', roster)).toBeNull();
    expect(matchTypedName('Luis Ortiz', roster)).toBeNull();
    expect(matchTypedName('   ', roster)).toBeNull();
  });
});
