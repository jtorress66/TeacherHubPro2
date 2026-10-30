import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { extractText, getDocumentProxy } from 'unpdf';
import { createTranslator, type Locale } from '@thp/i18n';
import { pdfPageCount } from '@thp/testing';
import { formatGpa, formatPercent } from '../src/server/gradebook-display.ts';
import { classWithStudents, signUp } from './helpers.ts';

type Status = '' | 'late' | 'missing' | 'excused';

/** Spanish formats use a no-break space before "%"; compare text with plain spaces. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

async function createAssignment(
  page: Page,
  locale: Locale,
  title: string,
  category: string,
  points: number,
) {
  const t = createTranslator(locale);
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form.getByLabel(t('gradebook.category'), { exact: true }).selectOption({ label: category });
  await form.getByLabel(t('gradebook.points')).fill(String(points));
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
}

/** Opens an assignment from the grid and saves a score and status per student. */
async function grade(
  page: Page,
  locale: Locale,
  title: string,
  rows: readonly { name: string; score?: number; status?: Status }[],
) {
  const t = createTranslator(locale);
  const gradebook = page.url();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  for (const row of rows) {
    if (row.score !== undefined) {
      await page.getByLabel(t('gradebook.scoreFor', { name: row.name })).fill(String(row.score));
    }
    await page
      .getByLabel(t('gradebook.statusFor', { name: row.name }))
      .selectOption(row.status ?? '');
  }
  await page.getByRole('button', { name: t('gradebook.saveGrades') }).click();
  await expect(page.getByRole('status')).toHaveText(t('gradebook.gradesSaved'));
  await page.goto(gradebook);
}

async function pdfText(response: APIResponse): Promise<{ pages: number; text: string }> {
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
  const bytes = new Uint8Array(await response.body());
  const { text } = await extractText(await getDocumentProxy(bytes.slice()), { mergePages: true });
  return { pages: pdfPageCount(bytes), text: plain(text) };
}

const row = (page: Page, testId: string, name: string) =>
  page.getByTestId(testId).filter({ hasText: name });

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const percent = (value: number) => plain(formatPercent(value, locale));

  // Build step 7 gate: grade a class → the gradebook and report agree → a report card PDF.
  test(`a teacher grades a class and downloads report cards (${locale})`, async ({ page }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    await page.goto(classPath + '/gradebook');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('gradebook.open'));
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    await expect(page.getByTestId('total-weight')).toHaveText(
      t('gradebook.totalWeight', { total: 100 }),
    );

    await createAssignment(page, locale, 'Examen 1', t('gradebook.standard_test'), 50);
    await createAssignment(page, locale, 'Tarea 1', t('gradebook.standard_homework'), 10);
    await grade(page, locale, 'Examen 1', [
      { name: 'Zayas, Ana', score: 45 },
      { name: 'Acosta, Ben', score: 35 },
      { name: 'Morales, Cara', status: 'excused' },
    ]);
    await grade(page, locale, 'Tarea 1', [
      { name: 'Zayas, Ana', score: 8 },
      { name: 'Acosta, Ben', status: 'missing' },
      { name: 'Morales, Cara', score: 9, status: 'late' },
    ]);

    // Test 30% and homework 25%, rescaled over the 55% that has grades.
    const ana = (30 * 90 + 25 * 80) / 55;
    const ben = (30 * 70 + 25 * 0) / 55;
    const cara = 90; // the test was excused, so only homework counts
    const overall = (name: string) => row(page, 'gradebook-row', name).getByTestId('overall');
    await expect(overall('Zayas')).toHaveText(formatPercent(ana, locale));
    await expect(overall('Acosta')).toHaveText(formatPercent(ben, locale));
    await expect(overall('Morales')).toHaveText(formatPercent(cara, locale));

    await page.goto(classPath + '/gradebook/report');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('gradebook.report'));
    await expect(page.getByTestId('class-average')).toHaveText(
      `${formatPercent((ana + ben + cara) / 3, locale)} (C)`,
    );
    for (const [letter, count] of [
      ['A', 1],
      ['B', 1],
      ['C', 0],
      ['D', 0],
      ['F', 1],
    ] as const) {
      await expect(page.getByTestId('distribution')).toContainText(
        t('gradebook.lettersCount', { letter, count }),
      );
    }

    await page.goto(`${classPath}/report-cards`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('reportCards.title'));
    const card = row(page, 'report-card', 'Zayas');
    await card
      .getByLabel(t('reportCards.commentFor', { name: 'Ana Zayas' }))
      .fill('Muy aplicada en clase.');
    await card.getByRole('button', { name: t('reportCards.saveComment') }).click();
    await expect(card.getByRole('status')).toHaveText(t('reportCards.commentSaved'));

    const download = page.getByRole('link', {
      name: t('reportCards.downloadFor', { name: 'Ana Zayas' }),
    });
    const one = await page.request.get((await download.getAttribute('href')) ?? '');
    expect(one.headers()['content-disposition']).toContain('.pdf');
    const single = await pdfText(one);
    expect(single.pages).toBe(1);
    for (const expected of [
      'Ana Zayas',
      'Historia 6',
      t('reportCards.documentTitle'),
      `${percent(ana)} (B)`,
      formatGpa(3 + (ana - 80) / 10, locale),
      'Muy aplicada en clase.',
      t('reportCards.signatureParent'),
    ]) {
      expect(single.text).toContain(expected);
    }

    const all = await page.request.get(
      (await page.getByTestId('download-all').getAttribute('href')) ?? '',
    );
    const everyone = await pdfText(all);
    expect(everyone.pages).toBe(3);
    expect(everyone.text).toContain('Cara Morales');
  });
}

test('a school logo uploaded in settings appears on report cards', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  const classPath = await classWithStudents(page, 'en');

  await page.getByRole('link', { name: t('nav.settings') }).click();
  await page.getByLabel(t('settings.logoFile')).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await page.getByRole('button', { name: t('settings.uploadLogo') }).click();
  await expect(page.getByRole('status')).toHaveText(t('settings.logoSaved'));
  await expect(page.getByTestId('logo-preview')).toBeVisible();

  const pdf = await page.request.get(`${classPath}/report-cards/pdf`);
  expect(pdf.status()).toBe(200);
  expect(new TextDecoder('latin1').decode(await pdf.body())).toMatch(/\/Subtype\s*\/Image/);

  // A file that is not a picture is refused.
  await page.getByLabel(t('settings.logoFile')).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await page.getByRole('button', { name: t('settings.uploadLogo') }).click();
  await expect(page.getByText(t('errors.invalid_format'))).toBeVisible();
});
