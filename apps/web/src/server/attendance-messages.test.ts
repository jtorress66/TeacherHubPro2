import { describe, expect, it } from 'vitest';
import type { StudentId } from '@thp/domain';
import { attendanceErrorMessage, attendanceFieldMessages } from './attendance-messages.ts';

describe('attendance error messages', () => {
  it('explains each attendance refusal in English and Spanish', () => {
    const unmarked = ['a', 'b'] as StudentId[];
    expect(attendanceErrorMessage({ code: 'incomplete', unmarked }, 'en')).toBe(
      'Mark every student before submitting (2 not marked).',
    );
    expect(attendanceErrorMessage({ code: 'incomplete', unmarked }, 'es')).toBe(
      'Marca a todos los estudiantes antes de enviar (2 sin marcar).',
    );
    expect(
      attendanceErrorMessage(
        { code: 'invalid_transition', from: 'submitted', action: 'mark' },
        'en',
      ),
    ).toBe('This day was submitted. Reopen it to make changes.');
    expect(
      attendanceErrorMessage({ code: 'invalid_transition', from: 'open', action: 'reopen' }, 'es'),
    ).toBe('Este día no se ha enviado.');
    expect(
      attendanceErrorMessage({ code: 'not_in_roster', studentId: 'x' as StudentId }, 'en'),
    ).toBe('A student is not on this class roster. Reload the page.');
  });

  it('uses the attendance wording for minutes late and notes, and the shared one otherwise', () => {
    expect(attendanceErrorMessage({ field: 'minutesLate', code: 'out_of_range' }, 'en')).toBe(
      'Minutes late must be a whole number from 1 to 240.',
    );
    expect(attendanceErrorMessage({ field: 'note', code: 'too_long' }, 'es')).toBe(
      'Las notas pueden tener hasta 200 caracteres.',
    );
    expect(attendanceErrorMessage({ code: 'class_archived' }, 'en')).toBe(
      'This class is archived. Restore it first.',
    );
  });

  it('turns form field codes into messages under the same fields', () => {
    expect(
      attendanceFieldMessages(
        { 'status.s1': 'invalid_format', 'minutesLate.s2': 'out_of_range', 'note.s3': 'too_long' },
        'en',
      ),
    ).toEqual({
      'status.s1': 'Please check this value.',
      'minutesLate.s2': 'Minutes late must be a whole number from 1 to 240.',
      'note.s3': 'Notes can be up to 200 characters.',
    });
  });
});
