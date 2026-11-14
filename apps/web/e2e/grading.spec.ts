import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { formatPercent } from '../src/server/gradebook-display.ts';
import {
  classWithAssignment,
  importQuestions,
  quizPdf,
  studentAnswers,
} from './grading-helpers.ts';
import { signUp, studentLink } from './helpers.ts';

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 10 gate: PDF → test → student submits from link → AI grades → teacher confirms
  // → the grade appears in the gradebook and report card.
  test(`a PDF becomes a test that a student answers and the teacher grades (${locale})`, async ({
    page,
    browser,
  }) => {
    // The journey waits for two worker jobs (reading the PDF, then AI grading).
    test.setTimeout(90_000);
    await signUp(page, locale);
    const classPath = await classWithAssignment(page, locale, 'Quiz espacial');
    await importQuestions(page, locale);
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const student = await studentAnswers(browser, locale, url, 'Quiz espacial');

    await page.goto(classPath + '/gradebook');
    await page.getByRole('link', { name: 'Quiz espacial', exact: true }).click();
    const steps = page.getByRole('list', { name: t('questions.stepsTitle') });
    await expect(steps).toContainText(t('questions.stepQuestionsDone', { questions: 3, files: 0 }));
    await expect(steps).toContainText(t('questions.stepLinked', { linked: 3, total: 3 }));
    await expect(steps).toContainText(t('questions.stepHandedIn', { handedIn: 1, toReview: 1 }));
    await page.getByRole('link', { name: t('questions.submissions') }).click();
    const ana = page.getByTestId('submission-Zayas');
    await expect(ana).toContainText(t('grading.status_submitted'));
    // Answers read as the student saw them: the option's letter and text, not its stored index.
    const choice = ana.getByRole('definition').filter({ hasText: 'Mercury' });
    await expect(choice).toContainText('A. Mercury');
    await expect(choice).toContainText(
      `${t('grading.correct')} · ${t('grading.pointsOf', { score: 4, points: 4 })}`,
    );
    await expect(choice).not.toContainText(/^0/);
    await expect(
      ana.getByRole('definition').filter({ hasText: t('questions.true') }),
    ).toContainText(t('grading.pointsOf', { score: 2, points: 2 }));
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

  await page.goto('/en/app/integrations');
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
