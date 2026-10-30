import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

/** A roster CSV with the header names a teacher would type in that language. */
function rosterCsv(locale: Locale, count: number): string {
  const header =
    locale === 'es'
      ? 'Nombre;Apellidos;Número de estudiante'
      : 'First name,Last name,Student number';
  const separator = locale === 'es' ? ';' : ',';
  const rows = Array.from({ length: count }, (_, i) =>
    [`Est${String(i + 1)}`, `Apellido${String(i + 1)}`, `N${String(i + 1)}`].join(separator),
  );
  return [header, ...rows].join('\r\n');
}

async function createClass(page: Page, locale: Locale, name: string) {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill(name);
  await form.getByLabel(t('classes.period')).fill('2');
  await form.getByLabel(t('classes.startTime')).fill('08:50');
  await form.getByLabel(t('classes.endTime')).fill('09:40');
  await form.getByLabel(t('weekdays.Tue')).uncheck();
  await form.getByLabel(t('weekdays.Thu')).uncheck();
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

async function importCsv(page: Page, locale: Locale, csv: string) {
  const t = createTranslator(locale);
  const form = page.getByRole('form', { name: t('students.importTitle') });
  await form.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await form.getByRole('button', { name: t('students.import') }).click();
}

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 5 gate: create a class with a schedule → import 25 students from CSV → edit one.
  test(`a teacher creates a class with a schedule, imports 25 students and edits one (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await createClass(page, locale, 'Matemáticas 7');
    const days = [t('weekdays.Mon'), t('weekdays.Wed'), t('weekdays.Fri')].join(', ');
    await expect(page.getByTestId('class-schedule')).toHaveText(
      `${t('classes.periodLabel', { period: 2 })} · 08:50–09:40 · ${days}`,
    );

    await importCsv(page, locale, rosterCsv(locale, 25));
    await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 25 }));
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(26);

    await page.getByRole('link', { name: `${t('students.edit')} Est7 Apellido7` }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('students.editTitle'));
    await page.getByLabel(t('students.lastName')).fill('Corregido');
    await page.getByRole('button', { name: t('students.save') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Matemáticas 7');
    await expect(page.getByRole('row', { name: /Corregido/ })).toContainText('Est7');
    await expect(page.getByRole('row', { name: /Apellido7 / })).toHaveCount(0);
  });
}

test('a CSV with a bad row imports nothing and says which line to fix', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await createClass(page, 'en', 'Science 8');

  await importCsv(page, 'en', 'First name,Last name\nAna,López\nBen,\nCarla,Ruiz\n');

  await expect(
    page.getByText(
      t('errors.csvRow', { line: 3, field: t('students.lastName'), message: t('errors.required') }),
    ),
  ).toBeVisible();
  await expect(page.getByText(t('students.empty'))).toBeVisible();
});

test('archiving a class hides it, keeps its roster and it can be restored', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await createClass(page, 'en', 'History 9');
  await importCsv(page, 'en', 'First name,Last name\nAna,López\n');
  await expect(page.getByRole('status')).toBeVisible();

  await page.getByRole('button', { name: t('classes.archive') }).click();
  await expect(page.getByText(t('classes.empty'))).toBeVisible();

  await page.getByRole('link', { name: t('classes.showArchived') }).click();
  await page.getByRole('link', { name: 'History 9' }).click();
  await expect(page.getByText(t('classes.archivedNotice'))).toBeVisible();
  await expect(page.getByRole('row', { name: /López/ })).toBeVisible();

  await page.getByRole('button', { name: t('classes.restore') }).click();
  // Wait for the restore to finish before leaving the page.
  await expect(page.getByRole('button', { name: t('classes.archive') })).toBeVisible();
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  await expect(page.getByRole('link', { name: 'History 9' })).toBeVisible();
});
