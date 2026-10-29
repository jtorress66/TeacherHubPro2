import type { ImportError } from '@thp/application';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import { messageFor } from './error-messages.ts';

/** CSV columns as the teacher sees them on the student form. */
const columnLabels: Readonly<Record<string, MessageKey>> = {
  firstName: 'students.firstName',
  lastName: 'students.lastName',
  studentNumber: 'students.studentNumber',
  parentEmail: 'students.parentEmail',
  accommodations: 'students.accommodations',
};

/** An import failure as messages: one per bad row, or a single message for the whole file. */
export function importErrorMessages(error: ImportError, locale: Locale): string[] {
  const t = createTranslator(locale);
  const label = (column: string) => {
    const key = columnLabels[column];
    return key === undefined ? column : t(key);
  };
  if (error.code === 'invalid_rows') {
    return error.rows.map((row) =>
      t('errors.csvRow', {
        line: row.line,
        field: label(row.field),
        message: t(`errors.${row.code}`),
      }),
    );
  }
  if (error.code === 'csv_missing_columns') {
    return [t('errors.csv_missing_columns', { columns: error.columns.map(label).join(', ') })];
  }
  if (error.code === 'csv_empty' || error.code === 'csv_too_many_rows')
    return [t(`errors.${error.code}`)];
  return [messageFor(error, locale)];
}
