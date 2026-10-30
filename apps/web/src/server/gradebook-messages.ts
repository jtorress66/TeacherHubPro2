import type { GradeEntryError } from '@thp/application';
import type { ValidationCode } from '@thp/domain';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import { formErrors } from './error-messages.ts';
import type { GradeFieldErrors } from './grade-forms.ts';

/** Gradebook wording for a field's error, where the shared message is too vague. */
const fieldKeys: Readonly<Record<string, Partial<Record<ValidationCode, MessageKey>>>> = {
  categoryId: { not_allowed: 'gradebook.errors.categoryNotInClass' },
  comment: { too_long: 'reportCards.errors.commentTooLong' },
};

/** How a refused grade row reads under its score field. */
const rowKeys: Partial<Record<ValidationCode, MessageKey>> = {
  not_allowed: 'gradebook.errors.notInClass',
};

/** A gradebook refusal as `{ field: message }`, with every refused grade under its score. */
export function gradeEntryMessages(error: GradeEntryError, locale: Locale): Record<string, string> {
  const t = createTranslator(locale);
  if (!('code' in error && error.code === 'invalid_grades')) {
    const key = 'field' in error ? fieldKeys[error.field]?.[error.code] : undefined;
    return key && 'field' in error ? { [error.field]: t(key) } : formErrors(error, locale);
  }
  const rows = Object.entries(error.rows);
  return {
    form: t('gradebook.errors.invalidGrades', { count: rows.length }),
    ...Object.fromEntries(
      rows.map(([studentId, code]) => [
        `score.${studentId}`,
        t(rowKeys[code] ?? 'gradebook.errors.score'),
      ]),
    ),
  };
}

/** The grade form's own shape errors as messages, under the same field names. */
export function gradeFieldMessages(
  errors: GradeFieldErrors,
  locale: Locale,
): Record<string, string> {
  const t = createTranslator(locale);
  const entries = Object.entries(errors);
  return {
    form: t('gradebook.errors.invalidGrades', { count: entries.length }),
    ...Object.fromEntries(entries.map(([name, code]) => [name, t(`errors.${code}`)])),
  };
}
