import { describe, expect, it } from 'vitest';
import { parseAttendanceForm } from './attendance-forms.ts';

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

const base = { locale: 'es', classId: 'class-1', date: '2026-09-14', intent: 'save' };

describe('attendance form', () => {
  it('reads one mark per student with its details', () => {
    const parsed = parseAttendanceForm(
      form({
        ...base,
        intent: 'submit',
        'status.s1': 'present',
        'note.s1': '',
        'minutesLate.s1': '',
        'status.s2': 'tardy',
        'minutesLate.s2': '7',
        'note.s2': '  Bus late ',
      }),
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        locale: 'es',
        classId: 'class-1',
        date: '2026-09-14',
        intent: 'submit',
        marks: [
          { studentId: 's1', status: 'present', minutesLate: null, note: null },
          { studentId: 's2', status: 'tardy', minutesLate: 7, note: 'Bus late' },
        ],
      },
    });
  });

  it('ignores minutes late unless the student is tardy', () => {
    const parsed = parseAttendanceForm(
      form({ ...base, 'status.s1': 'absent', 'minutesLate.s1': '15' }),
    );

    expect(parsed.ok && parsed.value.marks).toEqual([
      { studentId: 's1', status: 'absent', minutesLate: null, note: null },
    ]);
  });

  it('reports each bad field under its student', () => {
    const parsed = parseAttendanceForm(
      form({
        ...base,
        'status.s1': 'asleep',
        'status.s2': 'tardy',
        'minutesLate.s2': '300',
        'status.s3': 'tardy',
        'minutesLate.s3': 'soon',
        'status.s4': 'present',
        'note.s4': 'x'.repeat(201),
      }),
    );

    expect(parsed).toEqual({
      ok: false,
      error: {
        'status.s1': 'invalid_format',
        'minutesLate.s2': 'out_of_range',
        'minutesLate.s3': 'out_of_range',
        'note.s4': 'too_long',
      },
    });
  });

  it('defaults to saving, and falls back to English for an unknown language', () => {
    const parsed = parseAttendanceForm(
      form({ classId: 'class-1', date: '2026-09-14', locale: 'xx', intent: 'later' }),
    );

    expect(parsed.ok && parsed.value).toMatchObject({ intent: 'save', locale: 'en', marks: [] });
  });
});
