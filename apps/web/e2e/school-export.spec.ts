import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp, uniqueEmail } from './helpers.ts';
import { zipTexts } from './zip.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`the account owner downloads all school data as a ZIP of spreadsheets (${locale})`, async ({
    page,
  }) => {
    const t = createTranslator(locale);
    await signUp(page, locale, uniqueEmail('export'));
    await classWithStudents(page, locale);

    await page.getByRole('link', { name: t('nav.settings') }).click();
    const card = page.getByRole('region', { name: t('schoolExport.title') });
    await expect(card).toContainText(t('schoolExport.privacy'));
    const download = page.waitForEvent('download');
    await card.getByRole('link', { name: t('schoolExport.button') }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.zip$/u);

    const files = zipTexts(await readFile(await file.path()));
    expect(Object.keys(files)).toContain(`${t('schoolExport.file_grades')}.csv`);
    const students = files[`${t('schoolExport.file_students')}.csv`];
    expect(students).toContain(t('schoolExport.col_firstName'));
    expect(students).toContain('Historia 6,Ana,Zayas');
    expect(students).toContain('Historia 6,Ben,Acosta');
  });
}
