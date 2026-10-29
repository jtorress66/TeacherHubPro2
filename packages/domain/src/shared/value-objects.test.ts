import { describe, expect, it } from 'vitest';
import { parseEmail } from './email.ts';
import { type SchoolId } from './ids.ts';
import { defaultLanguage, isLanguage, languages } from './language.ts';
import { compareDates, parseLocalDate } from './local-date.ts';
import { andThen, err, ok } from './result.ts';
import { minutesOf, parseTimeOfDay } from './time-of-day.ts';
import { optionalText, requiredText } from './validation.ts';
import { defaultSchoolDays, parseWeekdays, weekdays } from './weekday.ts';
import { valueOf } from '../test-support.ts';

describe('email', () => {
  it('is trimmed and lower-cased', () => {
    expect(parseEmail('email', '  Ana.Lopez@School.EDU ')).toEqual(ok('ana.lopez@school.edu'));
  });

  it('treats a missing email as required', () => {
    expect(parseEmail('email', undefined)).toEqual(err({ field: 'email', code: 'required' }));
  });

  it('rejects text that is not an email address', () => {
    expect(parseEmail('email', 'ana@')).toEqual(err({ field: 'email', code: 'invalid_format' }));
    expect(parseEmail('email', '')).toEqual(err({ field: 'email', code: 'required' }));
  });
});

describe('local date', () => {
  it('accepts a real calendar date', () => {
    expect(parseLocalDate('date', '2026-02-28')).toEqual(ok('2026-02-28'));
    expect(parseLocalDate('date', '2028-02-29')).toEqual(ok('2028-02-29'));
  });

  it('rejects 2026-02-30 and badly formatted dates', () => {
    for (const value of ['2026-02-30', '2026-13-01', '2026-1-5', '05/01/2026']) {
      expect(parseLocalDate('date', value)).toEqual(err({ field: 'date', code: 'invalid_format' }));
    }
  });

  it('compares dates in calendar order', () => {
    const a = valueOf(parseLocalDate('d', '2026-01-31'));
    const b = valueOf(parseLocalDate('d', '2026-02-01'));

    expect(compareDates(a, b)).toBeLessThan(0);
    expect(compareDates(b, a)).toBeGreaterThan(0);
    expect(compareDates(a, a)).toBe(0);
  });
});

describe('time of day', () => {
  it('accepts HH:MM in 24-hour time', () => {
    expect(parseTimeOfDay('start', '08:05')).toEqual(ok('08:05'));
    expect(parseTimeOfDay('start', '23:59')).toEqual(ok('23:59'));
  });

  it('rejects 25:00 and 8:5', () => {
    expect(parseTimeOfDay('start', '25:00')).toEqual(
      err({ field: 'start', code: 'invalid_format' }),
    );
    expect(parseTimeOfDay('start', '8:5')).toEqual(err({ field: 'start', code: 'invalid_format' }));
  });

  it('converts to minutes after midnight', () => {
    expect(minutesOf(valueOf(parseTimeOfDay('start', '08:45')))).toBe(525);
  });
});

describe('weekdays', () => {
  it('school days default to Mon–Fri', () => {
    expect(defaultSchoolDays).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    expect(parseWeekdays('days', undefined)).toEqual(ok(defaultSchoolDays));
  });

  it('puts days in week order', () => {
    expect(parseWeekdays('days', ['Fri', 'Mon'])).toEqual(ok(['Mon', 'Fri']));
    expect(weekdays).toHaveLength(7);
  });

  it('rejects duplicates, unknown days and an empty list', () => {
    expect(parseWeekdays('days', ['Mon', 'Mon'])).toEqual(
      err({ field: 'days', code: 'duplicate' }),
    );
    expect(parseWeekdays('days', ['Lun'])).toEqual(err({ field: 'days', code: 'invalid_format' }));
    expect(parseWeekdays('days', [])).toEqual(err({ field: 'days', code: 'required' }));
  });
});

describe('language', () => {
  it('offers seven languages with English as the default', () => {
    expect(languages).toHaveLength(7);
    expect(defaultLanguage).toBe('en');
    expect(isLanguage('es')).toBe(true);
    expect(isLanguage('ru')).toBe(false);
  });
});

describe('text fields', () => {
  it('trims required text and rejects blank or too long values', () => {
    expect(requiredText('name', '  Math 7 ')).toEqual(ok('Math 7'));
    expect(requiredText('name', '   ')).toEqual(err({ field: 'name', code: 'required' }));
    expect(requiredText('name', 'x'.repeat(201))).toEqual(err({ field: 'name', code: 'too_long' }));
  });

  it('turns blank optional text into null', () => {
    expect(optionalText('notes', '  ')).toEqual(ok(null));
    expect(optionalText('notes', undefined)).toEqual(ok(null));
    expect(optionalText('notes', ' hi ')).toEqual(ok('hi'));
    expect(optionalText('notes', 'x'.repeat(3), 2)).toEqual(
      err({ field: 'notes', code: 'too_long' }),
    );
  });
});

describe('ids and results', () => {
  it('brands a string id without changing it', () => {
    const id: SchoolId = 'school-1' as SchoolId;
    expect(id).toBe('school-1');
  });

  it('chains results with andThen and stops at the first error', () => {
    const half = (n: number) => (n % 2 === 0 ? ok(n / 2) : err('odd'));
    expect(andThen(ok(8), half)).toEqual(ok(4));
    expect(andThen(ok(3), half)).toEqual(err('odd'));
    expect(andThen(err<string>('first'), half)).toEqual(err('first'));
  });
});
