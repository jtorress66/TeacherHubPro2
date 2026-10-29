import { describe, expect, it } from 'vitest';
import { type ClassId, type SchoolId, type SemesterId, type UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { archiveClass, createClass, restoreClass, updateClass } from './class.ts';
import { createSchedule } from './schedule.ts';

const base = {
  id: 'class-1' as ClassId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'user-1' as UserId,
  name: 'Math 7',
};

describe('createClass', () => {
  it('creates a class with only a name; other fields are null', () => {
    expect(valueOf(createClass(base))).toEqual({
      ...base,
      subject: null,
      grade: null,
      section: null,
      schoolYear: null,
      semesterId: null,
      schedule: null,
      archivedAt: null,
    });
  });

  it('keeps the details and the schedule', () => {
    const cls = valueOf(
      createClass({
        ...base,
        subject: 'Math',
        grade: '7',
        section: 'B',
        schoolYear: '2026-2027',
        semesterId: 'sem-1' as SemesterId,
        schedule: { period: 2, startTime: '08:50', endTime: '09:40' },
      }),
    );

    expect(cls.section).toBe('B');
    expect(cls.schedule).toEqual({
      period: 2,
      startTime: '08:50',
      endTime: '09:40',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    });
  });

  it('rejects a blank name', () => {
    expect(errorOf(createClass({ ...base, name: '   ' }))).toEqual({
      field: 'name',
      code: 'required',
    });
  });

  it('reports schedule errors', () => {
    expect(errorOf(createClass({ ...base, schedule: { period: 13 } }))).toEqual({
      field: 'period',
      code: 'out_of_range',
    });
  });

  it('rejects an over-long optional field', () => {
    expect(errorOf(createClass({ ...base, subject: 'x'.repeat(201) }))).toEqual({
      field: 'subject',
      code: 'too_long',
    });
  });
});

describe('createSchedule', () => {
  it('defaults to Mon–Fri with no period or times', () => {
    expect(valueOf(createSchedule({}))).toEqual({
      period: null,
      startTime: null,
      endTime: null,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    });
  });

  it('rejects period 0 and period 13', () => {
    for (const period of [0, 13, 2.5]) {
      expect(errorOf(createSchedule({ period }))).toEqual({
        field: 'period',
        code: 'out_of_range',
      });
    }
  });

  it('accepts periods 1 to 12', () => {
    expect(valueOf(createSchedule({ period: 1 })).period).toBe(1);
    expect(valueOf(createSchedule({ period: 12 })).period).toBe(12);
  });

  it('rejects an end time before the start time', () => {
    expect(errorOf(createSchedule({ startTime: '09:00', endTime: '08:00' }))).toEqual({
      field: 'endTime',
      code: 'invalid_order',
    });
    expect(errorOf(createSchedule({ startTime: '09:00', endTime: '09:00' }))).toEqual({
      field: 'endTime',
      code: 'invalid_order',
    });
  });

  it('needs both times or neither', () => {
    expect(errorOf(createSchedule({ startTime: '09:00' }))).toEqual({
      field: 'endTime',
      code: 'required',
    });
    expect(errorOf(createSchedule({ endTime: '09:00' }))).toEqual({
      field: 'startTime',
      code: 'required',
    });
  });

  it('reports bad times and bad days', () => {
    expect(errorOf(createSchedule({ startTime: '9am', endTime: '10:00' }))).toEqual({
      field: 'startTime',
      code: 'invalid_format',
    });
    expect(errorOf(createSchedule({ startTime: '09:00', endTime: '10' }))).toEqual({
      field: 'endTime',
      code: 'invalid_format',
    });
    expect(errorOf(createSchedule({ days: ['Mon', 'Mon'] }))).toEqual({
      field: 'days',
      code: 'duplicate',
    });
  });
});

describe('updateClass', () => {
  it('replaces the editable fields with validated values, keeping id, school and teacher', () => {
    const cls = valueOf(createClass(base));
    const updated = valueOf(
      updateClass(cls, {
        name: ' Math 7B ',
        subject: 'Math',
        schedule: { period: 3, days: ['Tue', 'Thu'] },
      }),
    );

    expect(updated).toMatchObject({
      id: base.id,
      schoolId: base.schoolId,
      teacherId: base.teacherId,
      name: 'Math 7B',
    });
    expect(updated.schedule).toEqual({
      period: 3,
      startTime: null,
      endTime: null,
      days: ['Tue', 'Thu'],
    });
  });

  it('rejects a blank name, a period of 13 and an end before the start', () => {
    const cls = valueOf(createClass(base));
    expect(errorOf(updateClass(cls, { name: '' }))).toEqual({ field: 'name', code: 'required' });
    expect(errorOf(updateClass(cls, { name: 'A', schedule: { period: 13 } }))).toEqual({
      field: 'period',
      code: 'out_of_range',
    });
    expect(
      errorOf(updateClass(cls, { name: 'A', schedule: { startTime: '10:00', endTime: '09:00' } })),
    ).toEqual({ field: 'endTime', code: 'invalid_order' });
  });

  it('keeps an archived class archived', () => {
    const archived = archiveClass(valueOf(createClass(base)), new Date('2026-10-01T00:00:00Z'));
    expect(valueOf(updateClass(archived, { name: 'Renamed' })).archivedAt).toEqual(
      new Date('2026-10-01T00:00:00Z'),
    );
  });
});

describe('archiving', () => {
  it('archives a class and restores it', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const archived = archiveClass(valueOf(createClass(base)), now);

    expect(archived.archivedAt).toEqual(now);
    expect(restoreClass(archived).archivedAt).toBeNull();
  });
});
