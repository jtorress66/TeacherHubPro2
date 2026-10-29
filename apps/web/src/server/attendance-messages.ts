import type { AttendanceUseCaseError } from '@thp/application';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import type { AttendanceFieldCode, AttendanceFieldErrors } from './attendance-forms.ts';
import { messageFor } from './error-messages.ts';

const fieldKeys: Readonly<Record<string, MessageKey>> = {
  minutesLate: 'attendance.errors.minutesLate',
  note: 'attendance.errors.noteTooLong',
};

/** An attendance refusal in the page's language. */
export function attendanceErrorMessage(error: AttendanceUseCaseError, locale: Locale): string {
  const t = createTranslator(locale);
  if ('field' in error) {
    const key = fieldKeys[error.field];
    return key ? t(key) : messageFor(error, locale);
  }
  switch (error.code) {
    case 'incomplete':
      return t('attendance.errors.incomplete', { count: error.unmarked.length });
    case 'invalid_transition':
      return t(
        error.from === 'submitted'
          ? 'attendance.errors.submitted'
          : 'attendance.errors.notSubmitted',
      );
    case 'not_in_roster':
      return t('attendance.errors.notInRoster');
    default:
      return messageFor(error, locale);
  }
}

const codeKeys: Readonly<Record<AttendanceFieldCode, MessageKey>> = {
  invalid_format: 'errors.invalid_format',
  out_of_range: 'attendance.errors.minutesLate',
  too_long: 'attendance.errors.noteTooLong',
};

/** The sheet's field errors as messages, under the same field names. */
export function attendanceFieldMessages(
  errors: AttendanceFieldErrors,
  locale: Locale,
): Record<string, string> {
  const t = createTranslator(locale);
  return Object.fromEntries(
    Object.entries(errors).map(([name, code]) => [name, t(codeKeys[code])]),
  );
}
