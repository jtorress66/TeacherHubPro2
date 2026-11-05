import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/** A class that meets every day of the week, so it is always one of today's classes. */
async function everyDayClass(page: Page, locale: Locale): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Ciencias 6');
  await form.getByLabel(t('weekdays.Sat')).check();
  await form.getByLabel(t('weekdays.Sun')).check();
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ciencias 6');
  const roster = page.getByRole('form', { name: t('students.importTitle') });
  await roster.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('First name,Last name\nAna,Zayas\nBen,Acosta\n', 'utf8'),
  });
  await roster.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 2 }));
  return new URL(page.url()).pathname;
}

async function gradeAssignment(
  page: Page,
  locale: Locale,
  title: string,
  rows: readonly { name: string; score?: number; status?: string }[],
) {
  const t = createTranslator(locale);
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form
    .getByLabel(t('gradebook.category'), { exact: true })
    .selectOption({ label: t('gradebook.standard_test') });
  await form.getByLabel(t('gradebook.points')).fill('10');
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
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

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 15 gate: the dashboard shows today's classes and an at-risk student.
  test(`the Command Center shows today's class and a student at risk, with their Student 360 (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUp(page, locale);
    const classPath = await everyDayClass(page, locale);

    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();
    await gradeAssignment(page, locale, 'Quiz', [
      { name: 'Zayas, Ana', score: 2 },
      { name: 'Acosta, Ben', score: 9 },
    ]);
    await gradeAssignment(page, locale, 'Essay', [
      { name: 'Zayas, Ana', status: 'missing' },
      { name: 'Acosta, Ben', score: 8 },
    ]);

    await page.goto(`/${locale}/app`);
    const today = page.getByRole('region', { name: t('commandCenter.today') });
    await expect(today.getByRole('link', { name: 'Ciencias 6' })).toBeVisible();
    await today.getByRole('link', { name: t('commandCenter.takeAttendance') }).click();
    await page.getByRole('button', { name: t('attendance.submit'), exact: true }).click();
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));

    await page.goto(`/${locale}/app`);
    await expect(today.getByText(t('commandCenter.attendance_done'))).toBeVisible();
    const atRisk = page.getByRole('list', { name: t('commandCenter.atRisk') });
    await expect(atRisk.getByRole('listitem')).toHaveCount(1);
    await expect(atRisk).toContainText(t('commandCenter.riskScore', { score: 4 }));
    await expect(atRisk).toContainText(t('risk.missing', { value: 1 }));
    expect(await axe(page)).toEqual([]);

    await atRisk.getByRole('link', { name: 'Ana Zayas' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ana Zayas');
    await expect(page.getByTestId('student-missing')).toHaveText('1');
    await expect(page.getByRole('list', { name: t('student360.timeline') })).toContainText('Quiz');

    const noteForm = page.getByRole('form', { name: t('student360.addNote') });
    await noteForm.getByLabel(t('student360.note')).fill('Talked with her after class.');
    await noteForm.getByRole('button', { name: t('student360.addNote') }).click();
    await expect(page.getByRole('list', { name: t('student360.notes') })).toContainText(
      'Talked with her after class.',
    );

    await page.getByRole('button', { name: t('student360.generate') }).click();
    const insight = page.getByRole('list', { name: t('student360.insight') });
    await expect(insight.getByRole('listitem')).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByRole('button', { name: t('student360.regenerate') })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}
