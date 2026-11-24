import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { joinSchoolOf } from './database.ts';
import { docxFile } from './docx.ts';
import { signUp } from './helpers.ts';

const guideLines = [
  'Grade 4 Mathematics Pacing Guide',
  'Unit 1 (weeks 1-4): Place value to one million',
  'Unit 2 (weeks 5-8): Multiplying by one digit',
];

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`the school owner adds curriculum guides from a Word file and pasted text, and teachers see them (${locale})`, async ({
    page,
    browser,
  }) => {
    const t = createTranslator(locale);
    const ownerEmail = await signUp(page, locale);

    await page.getByRole('link', { name: t('curriculum.link') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('curriculum.title'));
    await expect(page.getByText(t('curriculum.empty'))).toBeVisible();
    const form = page.getByRole('form', { name: t('curriculum.addHeading') });
    const rows = page.getByTestId('curriculum-row');

    // A Word file: read in the background, then ready.
    await form.getByLabel(t('curriculum.col_subject')).selectOption('math');
    await form.getByLabel(t('curriculum.col_grade')).selectOption('4');
    await form.getByLabel(t('curriculum.guideTitle')).fill('Math 4 pacing guide');
    await form.getByLabel(t('curriculum.file')).setInputFiles({
      name: 'Pacing guide.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: docxFile(guideLines),
    });
    await form.getByRole('button', { name: t('curriculum.upload') }).click();
    await expect(form.getByRole('status')).toHaveText(t('curriculum.reading'));
    const mathRow = rows.filter({ hasText: 'Math 4 pacing guide' });
    await expect(mathRow).toContainText(t('curriculum.status_ready'), { timeout: 30_000 });
    await expect(mathRow).toContainText('Pacing guide.docx');
    await expect(mathRow).toContainText(t('assistant.subject_math'));

    // Pasted text: ready at once.
    await form.getByLabel(t('curriculum.col_subject')).selectOption('science');
    await form.getByLabel(t('curriculum.col_grade')).selectOption('K');
    await form.getByLabel(t('curriculum.guideTitle')).fill('Science K units');
    await form
      .getByLabel(t('curriculum.text'))
      .fill('Unit 1: Weather and seasons. Unit 2: Plants and animals need food and water.');
    await form.getByRole('button', { name: t('curriculum.upload') }).click();
    await expect(form.getByRole('status')).toHaveText(t('curriculum.saved'));
    const scienceRow = rows.filter({ hasText: 'Science K units' });
    await expect(scienceRow).toContainText(t('curriculum.pasted'));
    await expect(scienceRow).toContainText(t('curriculum.status_ready'));
    await expect(rows).toHaveCount(2);

    // Only PDF and Word files.
    await form.getByLabel(t('curriculum.guideTitle')).fill('Notes');
    await form.getByLabel(t('curriculum.file')).setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Unit 1: Fractions and decimals for the whole year.'),
    });
    await form.getByRole('button', { name: t('curriculum.upload') }).click();
    await expect(form.getByText(t('curriculum.fileKinds'))).toBeVisible();
    await expect(rows).toHaveCount(2);

    // A colleague in the same school sees the guides but cannot change them.
    const colleague = await browser.newContext();
    const colleaguePage = await colleague.newPage();
    const colleagueEmail = await signUp(colleaguePage, locale);
    await joinSchoolOf(colleagueEmail, ownerEmail);
    await colleaguePage.goto(`/${locale}/app/curriculum`);
    await expect(colleaguePage.getByTestId('curriculum-row')).toHaveCount(2);
    await expect(colleaguePage.getByText(t('curriculum.readOnly'))).toBeVisible();
    await expect(colleaguePage.getByRole('form', { name: t('curriculum.addHeading') })).toHaveCount(
      0,
    );
    await expect(colleaguePage.getByRole('button', { name: t('curriculum.remove') })).toHaveCount(
      0,
    );
    await colleague.close();

    // The owner removes one.
    await page
      .getByRole('button', { name: t('curriculum.removeLabel', { title: 'Science K units' }) })
      .click();
    await expect(page.getByText(t('curriculum.removed'))).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Math 4 pacing guide');
  });
}
