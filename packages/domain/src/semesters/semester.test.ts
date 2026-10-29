import { describe, expect, it } from 'vitest';
import { type SchoolId, type SemesterId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { activateSemester, createSemester, updateSemester } from './semester.ts';

const schoolId = 'school-1' as SchoolId;
const make = (id: string, isActive = false) =>
  valueOf(
    createSemester({
      id: id as SemesterId,
      schoolId,
      name: `Semester ${id}`,
      startDate: '2026-08-15',
      endDate: '2026-12-20',
      isActive,
    }),
  );

describe('createSemester', () => {
  it('creates an inactive semester by default', () => {
    const semester = valueOf(
      createSemester({
        id: 's1' as SemesterId,
        schoolId,
        name: 'Fall',
        startDate: '2026-08-15',
        endDate: '2026-12-20',
        schoolYear: '2026-2027',
      }),
    );

    expect(semester).toMatchObject({ name: 'Fall', isActive: false, schoolYear: '2026-2027' });
  });

  it('allows a one-day semester but rejects an end before the start', () => {
    const input = { id: 's1' as SemesterId, schoolId, name: 'X', startDate: '2026-08-15' };

    expect(valueOf(createSemester({ ...input, endDate: '2026-08-15' })).endDate).toBe('2026-08-15');
    expect(errorOf(createSemester({ ...input, endDate: '2026-08-14' }))).toEqual({
      field: 'endDate',
      code: 'invalid_order',
    });
  });

  it('rejects bad dates and a blank name', () => {
    const input = { id: 's1' as SemesterId, schoolId, name: 'X', endDate: '2026-12-20' };

    expect(errorOf(createSemester({ ...input, startDate: '2026-02-30' }))).toEqual({
      field: 'startDate',
      code: 'invalid_format',
    });
    expect(errorOf(createSemester({ ...input, startDate: '2026-08-15', endDate: 'soon' }))).toEqual(
      {
        field: 'endDate',
        code: 'invalid_format',
      },
    );
    expect(errorOf(createSemester({ ...input, startDate: '2026-08-15', name: '' }))).toEqual({
      field: 'name',
      code: 'required',
    });
  });
});

describe('createSemester limits', () => {
  it('rejects an over-long school year', () => {
    expect(
      errorOf(
        createSemester({
          id: 's1' as SemesterId,
          schoolId,
          name: 'X',
          startDate: '2026-08-15',
          endDate: '2026-12-20',
          schoolYear: 'y'.repeat(201),
        }),
      ),
    ).toEqual({ field: 'schoolYear', code: 'too_long' });
  });
});

describe('activateSemester', () => {
  it('activating one deactivates the others', () => {
    const semesters = [make('a', true), make('b'), make('c')];

    const result = valueOf(activateSemester(semesters, 'b' as SemesterId));

    expect(result.map((s) => [s.id, s.isActive])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
  });

  it('fails for a semester that is not in the list', () => {
    expect(errorOf(activateSemester([make('a')], 'z' as SemesterId))).toEqual({
      code: 'not_found',
    });
  });
});

describe('updateSemester', () => {
  it('changes name and dates with the same rules and keeps whether it is active', () => {
    const active = make('a', true);
    const updated = valueOf(
      updateSemester(active, { name: 'Spring', startDate: '2027-01-10', endDate: '2027-05-30' }),
    );

    expect(updated).toMatchObject({
      id: 'a',
      name: 'Spring',
      startDate: '2027-01-10',
      isActive: true,
    });
    expect(
      errorOf(
        updateSemester(active, { name: 'X', startDate: '2027-05-30', endDate: '2027-01-10' }),
      ),
    ).toEqual({
      field: 'endDate',
      code: 'invalid_order',
    });
  });
});
