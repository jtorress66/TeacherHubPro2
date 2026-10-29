import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { formatRate } from '../src/server/attendance-display.ts';
import { signUp } from './helpers.ts';

/** Creates a class with Ana Zayas, Ben Acosta and Cara Morales; returns its page's path. */
async function classWithStudents(page: Page, locale: Locale): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Historia 6');
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia 6');

  const importForm = page.getByRole('form', { name: t('students.importTitle') });
  await importForm.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('First name,Last name\nAna,Zayas\nBen,Acosta\nCara,Morales\n', 'utf8'),
  });
  await importForm.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 3 }));
  return new URL(page.url()).pathname;
}

async function openDay(page: Page, locale: Locale, classPath: string, date: string) {
  const t = createTranslator(locale);
  await page.goto(`${classPath}/attendance?date=${date}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(t('attendance.take'));
  await expect(page.getByLabel(t('attendance.date'))).toHaveValue(date);
}

function mark(page: Page, locale: Locale, name: string, status: 'present' | 'absent' | 'tardy') {
  const t = createTranslator(locale);
  return page
    .getByRole('group', { name: t('attendance.statusFor', { name }) })
    .getByLabel(t(`attendance.status_${status}`))
    .check();
}

async function submit(page: Page, locale: Locale) {
  const t = createTranslator(locale);
  await page.getByRole('button', { name: t('attendance.submit'), exact: true }).click();
  await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));
}

async function openReport(page: Page, locale: Locale, classPath: string) {
  const t = createTranslator(locale);
  await page.goto(`${classPath}/attendance/report`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(t('attendance.report'));
  await page.getByLabel(t('attendance.from'), { exact: true }).fill('2026-09-01');
  await page.getByLabel(t('attendance.to'), { exact: true }).fill('2026-09-30');
  await page.getByRole('button', { name: t('attendance.show') }).click();
  await expect(page.getByTestId('report-range')).toContainText('2026-09-01');
}

const row = (page: Page, name: string) => page.getByTestId('report-row').filter({ hasText: name });

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const rate = (value: number, band: 'good' | 'warning' | 'low') =>
    `${formatRate(value, locale)} (${t(`attendance.band_${band}`)})`;

  // Build step 6 gate: take attendance on two days → submit → the report shows the right rates.
  test(`a teacher takes attendance on two days and the report shows the rates (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    // Day 1: everyone starts present; Ana is absent.
    await openDay(page, locale, classPath, '2026-09-14');
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_new'));
    await mark(page, locale, 'Ana Zayas', 'absent');
    await submit(page, locale);
    await expect(page.getByTestId('attendance-read-only')).toContainText(
      t('attendance.status_absent'),
    );

    // Day 2: Ben is 5 minutes late, with a note; saved first, then submitted.
    await openDay(page, locale, classPath, '2026-09-15');
    await mark(page, locale, 'Ben Acosta', 'tardy');
    await page.getByLabel(t('attendance.minutesLateFor', { name: 'Ben Acosta' })).fill('5');
    await page.getByLabel(t('attendance.noteFor', { name: 'Ben Acosta' })).fill('Bus');
    await page.getByRole('button', { name: t('attendance.save'), exact: true }).click();
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_open'));
    await submit(page, locale);
    const ben = page.getByTestId('attendance-read-only').getByRole('row', { name: /Ben Acosta/ });
    await expect(ben).toContainText(t('attendance.status_tardy'));
    await expect(ben).toContainText('5');
    await expect(ben).toContainText('Bus');

    await openReport(page, locale, classPath);
    await expect(page.getByTestId('report-range')).toContainText(
      t('attendance.daysCounted', { count: 2 }),
    );
    await expect(row(page, 'Acosta, Ben')).toContainText(rate(100, 'good'));
    await expect(row(page, 'Morales, Cara')).toContainText(rate(100, 'good'));
    await expect(row(page, 'Zayas, Ana')).toContainText(rate(50, 'low'));
    await expect(page.getByTestId('class-rate')).toHaveText(rate((5 / 6) * 100, 'warning'));

    // Reopen day 1 to correct Ana's mark; the report follows.
    await openDay(page, locale, classPath, '2026-09-14');
    await page.getByRole('button', { name: t('attendance.reopen') }).click();
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_open'));
    await page.getByRole('button', { name: t('attendance.markAllPresent') }).click();
    await submit(page, locale);

    await openReport(page, locale, classPath);
    await expect(row(page, 'Zayas, Ana')).toContainText(rate(100, 'good'));
    await expect(page.getByTestId('class-rate')).toHaveText(rate(100, 'good'));
  });
}

test('the attendance page lists classes with the day’s status', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  const classPath = await classWithStudents(page, 'en');
  await openDay(page, 'en', classPath, '2026-09-14');
  await submit(page, 'en');

  await page.getByRole('link', { name: t('nav.attendance'), exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('attendance.title'));
  await page.getByLabel(t('attendance.date')).fill('2026-09-14');
  await page.getByRole('button', { name: t('attendance.show') }).click();
  await expect(page.getByRole('row', { name: /Historia 6/ })).toContainText(
    t('attendance.dayStatus_submitted'),
  );

  await page.getByLabel(t('attendance.date')).fill('2026-09-15');
  await page.getByRole('button', { name: t('attendance.show') }).click();
  await expect(page.getByRole('row', { name: /Historia 6/ })).toContainText(
    t('attendance.dayStatus_not_taken'),
  );
});
