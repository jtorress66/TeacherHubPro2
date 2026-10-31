import { expect, test, type Browser, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createTranslator, type Locale } from '@thp/i18n';
import { formatPercent } from '../src/server/gradebook-display.ts';
import { classWithStudents, signUp } from './helpers.ts';

/** A small typed test, as a teacher's PDF would be. */
async function quizPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([500, 300]);
  page.drawText('Space Quiz', { x: 30, y: 260, size: 16, font });
  page.drawText('1. Which planet is closest to the Sun?', { x: 30, y: 230, size: 12, font });
  page.drawText('2. True or false: the Sun is a star.', { x: 30, y: 210, size: 12, font });
  return Buffer.from(await doc.save());
}

/** A class with three students, the standard categories and one assignment; returns its page. */
async function classWithAssignment(page: Page, locale: Locale, title: string): Promise<string> {
  const t = createTranslator(locale);
  const classPath = await classWithStudents(page, locale);
  await page.goto(`${classPath}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form
    .getByLabel(t('gradebook.category'), { exact: true })
    .selectOption({ label: t('gradebook.standard_test') });
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  return classPath;
}

/** Imports the PDF (the worker's stand-in reads it into three questions) and saves them. */
async function importQuestions(page: Page, locale: Locale): Promise<void> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('questions.open') }).click();
  const importForm = page.getByRole('form', { name: t('pdfImport.title') });
  await importForm
    .getByLabel(t('pdfImport.file'))
    .setInputFiles({ name: 'quiz.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
  await importForm.getByRole('button', { name: t('pdfImport.submit') }).click();
  await expect(page.getByRole('note')).toHaveText(t('questions.imported'), { timeout: 30_000 });
  const builder = page.getByRole('form', { name: t('questions.title') });
  await expect(builder.getByRole('listitem')).toHaveCount(3);
  await builder.getByRole('button', { name: t('questions.save') }).click();
  await expect(page).toHaveURL(/\/questions\?saved=1$/);
  await expect(
    page.getByRole('form', { name: t('questions.title') }).getByRole('listitem'),
  ).toHaveCount(3);
}

/** Issues the class's links and returns the one for the named student. */
async function studentLink(
  page: Page,
  locale: Locale,
  classPath: string,
  name: string,
): Promise<string> {
  const t = createTranslator(locale);
  await page.goto(`${classPath}/student-links`);
  await page.getByRole('button', { name: t('studentLinks.issue') }).click();
  const issued = page.getByRole('region', { name: t('studentLinks.issuedTitle') });
  const link = issued.getByRole('row').filter({ hasText: name }).getByTestId('student-link');
  return (await link.getAttribute('href')) ?? '';
}

/** The student opens their link in their own browser, answers and hands in. */
async function studentAnswers(browser: Browser, locale: Locale, url: string, title: string) {
  const t = createTranslator(locale);
  const student = await browser.newPage();
  await student.goto(url);
  await expect(student.getByRole('heading', { level: 1 })).toHaveText(
    t('student.hello', { name: 'Ana' }),
  );
  await student.getByRole('link', { name: title }).click();
  await student.getByRole('radio', { name: 'Mercury' }).check();
  await student.getByRole('radio', { name: t('questions.true') }).check();
  await student.getByLabel('Why do we have day and night?').fill('Because the Earth turns around.');
  await student.getByRole('button', { name: t('student.submit') }).click();
  await expect(student.getByRole('status')).toContainText(
    t('student.submitted', { date: '' }).split(' ')[0] ?? '',
  );
  return student;
}

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 10 gate: PDF → test → student submits from link → AI grades → teacher confirms
  // → the grade appears in the gradebook and report card.
  test(`a PDF becomes a test that a student answers and the teacher grades (${locale})`, async ({
    page,
    browser,
  }) => {
    await signUp(page, locale);
    const classPath = await classWithAssignment(page, locale, 'Quiz espacial');
    await importQuestions(page, locale);
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const student = await studentAnswers(browser, locale, url, 'Quiz espacial');

    await page.goto(classPath + '/gradebook');
    await page.getByRole('link', { name: 'Quiz espacial', exact: true }).click();
    await page.getByRole('link', { name: t('questions.submissions') }).click();
    const ana = page.getByTestId('submission-Zayas');
    await expect(ana).toContainText(t('grading.status_submitted'));
    await page.getByRole('button', { name: t('grading.gradeWithAi') }).click();
    await expect(ana).toContainText(t('grading.status_ai_graded'), { timeout: 30_000 });
    await expect(ana).toContainText(t('grading.draft', { score: 8, max: 10 }));

    await ana.getByLabel(`${t('grading.score')} (/10)`).fill('9');
    await ana.getByRole('button', { name: t('grading.confirm') }).click();
    await expect(ana).toContainText(t('grading.confirmed', { score: 9, max: 10 }));

    await page.goto(classPath + '/gradebook');
    await expect(
      page.getByTestId('gradebook-row').filter({ hasText: 'Zayas' }).getByTestId('overall'),
    ).toHaveText(formatPercent(90, locale));
    await page.goto(classPath + '/report-cards');
    await expect(page.getByTestId('report-card').filter({ hasText: 'Zayas' })).toContainText(
      formatPercent(90, locale),
    );

    await student.reload();
    await expect(student.getByText(t('student.grade', { score: 9, max: 10 }))).toBeVisible();
    await student.close();
  });
}

test('files open from a student link, and a revoked link stops working', async ({
  page,
  browser,
}) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  const classPath = await classWithAssignment(page, 'en', 'Reading');
  await page.getByRole('link', { name: t('questions.open') }).click();
  const upload = page.getByRole('form', { name: t('attachments.upload') });
  await upload
    .getByLabel(t('attachments.file'))
    .setInputFiles({ name: 'story.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
  await upload.getByRole('button', { name: t('attachments.upload') }).click();
  await expect(page.getByRole('link', { name: 'story.pdf' })).toBeVisible();

  const url = await studentLink(page, 'en', classPath, 'Ben Acosta');
  const student = await browser.newPage();
  await student.goto(url);
  await student.getByRole('link', { name: 'Reading' }).click();
  const file = await student.request.get(
    (await student.getByRole('link', { name: 'story.pdf' }).getAttribute('href')) ?? '',
  );
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('application/pdf');

  await page.goto(`${classPath}/student-links`);
  await page
    .getByRole('row')
    .filter({ hasText: 'Ben Acosta' })
    .getByRole('button', { name: t('studentLinks.revoke') })
    .click();
  await expect(page.getByRole('row').filter({ hasText: 'Ben Acosta' })).toContainText(
    t('studentLinks.status_revoked'),
  );
  await student.goto(url);
  await expect(student.getByText(t('student.notFound'))).toBeVisible();
  await student.close();
});

test('Google Classroom (local stand-in) connects, imports a roster and shares an assignment', async ({
  page,
}) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  const classPath = await classWithAssignment(page, 'en', 'Quiz');
  const assignmentPath = new URL(page.url()).pathname;

  await page.goto('/en/app/settings');
  await page.getByRole('link', { name: t('classroom.connect') }).click();
  await expect(
    page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
  ).toBeVisible();

  await page.goto(classPath);
  const roster = page.getByRole('form', { name: t('classroom.importRoster') });
  await roster.getByRole('button', { name: t('classroom.importRoster') }).click();
  await expect(roster.getByRole('status')).toHaveText(
    t('classroom.imported', { added: 2, skipped: 0 }),
  );

  await page.goto(`${assignmentPath}/questions`);
  const builder = page.getByRole('form', { name: t('questions.title') });
  await page.getByLabel(t('questions.type')).selectOption('true_false');
  await page.getByRole('button', { name: t('questions.add') }).click();
  await builder
    .getByLabel(t('questions.prompt'), { exact: true })
    .fill('The Moon orbits the Earth.');
  await builder.getByRole('button', { name: t('questions.save') }).click();
  await expect(builder.getByRole('status')).toHaveText(t('questions.saved'));

  const share = page.getByRole('form', { name: t('classroom.share') });
  await share.getByRole('button', { name: t('classroom.share') }).click();
  await expect(share.getByRole('status')).toContainText(t('classroom.shared'));
});
