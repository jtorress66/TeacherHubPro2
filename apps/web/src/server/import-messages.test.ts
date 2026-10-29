import { describe, expect, it } from 'vitest';
import { createTranslator } from '@thp/i18n';
import { importErrorMessages } from './import-messages.ts';

describe('importErrorMessages', () => {
  it('explains each bad row with its line, its column and the reason, in the page language', () => {
    expect(
      importErrorMessages(
        {
          code: 'invalid_rows',
          rows: [
            { line: 3, field: 'lastName', code: 'required' },
            { line: 4, field: 'studentNumber', code: 'duplicate' },
          ],
        },
        'es',
      ),
    ).toEqual([
      'Línea 3: Apellidos. Este campo es obligatorio.',
      'Línea 4: Número de estudiante. Aparece más de una vez.',
    ]);
  });

  it('names the missing columns', () => {
    expect(
      importErrorMessages(
        { code: 'csv_missing_columns', columns: ['firstName', 'lastName'] },
        'en',
      ),
    ).toEqual(['The file needs these columns: First name, Last name.']);
  });

  it('turns other errors into a single message', () => {
    const t = createTranslator('en');
    expect(importErrorMessages({ code: 'csv_empty' }, 'en')).toEqual([t('errors.csv_empty')]);
    expect(importErrorMessages({ code: 'class_archived' }, 'en')).toEqual([
      t('errors.class_archived'),
    ]);
  });
});
