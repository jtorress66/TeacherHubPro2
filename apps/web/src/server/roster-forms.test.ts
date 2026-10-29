import { describe, expect, it } from 'vitest';
import { parseForm } from './forms.ts';
import { classForm, semesterForm, studentForm, toClassChanges } from './roster-forms.ts';

const form = (fields: Record<string, string | string[]>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
};

describe('class form', () => {
  it('reads the details, the schedule and every checked day', () => {
    const parsed = parseForm(
      classForm,
      form({
        name: 'Matemáticas 7',
        subject: 'Math',
        period: '2',
        startTime: '08:50',
        endTime: '09:40',
        days: ['Mon', 'Wed', 'Fri'],
        semesterId: '',
        locale: 'es',
      }),
    );

    expect(parsed.ok && toClassChanges(parsed.value)).toEqual({
      name: 'Matemáticas 7',
      subject: 'Math',
      grade: null,
      section: null,
      schoolYear: null,
      semesterId: null,
      schedule: { period: 2, startTime: '08:50', endTime: '09:40', days: ['Mon', 'Wed', 'Fri'] },
    });
  });

  it('leaves the days to the default (Mon–Fri) when none is checked, and reads one checked day', () => {
    const none = parseForm(classForm, form({ name: 'Art' }));
    expect(none.ok && toClassChanges(none.value).schedule).toEqual({
      period: null,
      startTime: null,
      endTime: null,
    });

    const one = parseForm(classForm, form({ name: 'Art', days: 'Tue', semesterId: 'sem-1' }));
    expect(one.ok && toClassChanges(one.value)).toMatchObject({
      semesterId: 'sem-1',
      schedule: { days: ['Tue'] },
    });
  });

  it('requires a name and a whole-number period', () => {
    expect(parseForm(classForm, form({ name: '', period: 'two' }))).toEqual({
      ok: false,
      error: { name: 'required', period: 'invalid_format' },
    });
  });
});

describe('student and semester forms', () => {
  it('reads a student with blank optional fields as null', () => {
    expect(
      parseForm(studentForm, form({ firstName: 'Ana', lastName: 'López', parentEmail: '' })),
    ).toEqual({
      ok: true,
      value: {
        firstName: 'Ana',
        lastName: 'López',
        studentNumber: null,
        parentEmail: null,
        accommodations: null,
        locale: 'en',
      },
    });
  });

  it('reads a semester and whether to make it active', () => {
    expect(
      parseForm(
        semesterForm,
        form({ name: 'Fall', startDate: '2026-08-15', endDate: '2026-12-20', makeActive: 'on' }),
      ),
    ).toEqual({
      ok: true,
      value: {
        name: 'Fall',
        startDate: '2026-08-15',
        endDate: '2026-12-20',
        schoolYear: null,
        makeActive: true,
        locale: 'en',
      },
    });
    expect(
      parseForm(
        semesterForm,
        form({ name: 'Fall', startDate: '2026-08-15', endDate: '2026-12-20' }),
      ),
    ).toMatchObject({ value: { makeActive: false } });
  });
});
