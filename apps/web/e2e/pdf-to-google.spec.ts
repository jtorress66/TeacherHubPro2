import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createTranslator, type Locale } from '@thp/i18n';
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

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher posts a test PDF straight to Google Classroom, a copy for each student (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.goto(`/${locale}/app/assistant`);
    const card = page.getByRole('region', { name: t('pdfTest.title') });
    await card.getByRole('link', { name: t('pdfTest.connect') }).click();
    await expect(
      page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
    ).toBeVisible();

    await page.goto(`/${locale}/app/assistant`);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#pdf-test-card')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    const post = card.getByRole('form', { name: t('pdfPost.submit') });
    await post.getByLabel(t('classroom.course')).selectOption({ label: 'Local Classroom course' });
    await post.getByLabel(t('pdfPost.name')).fill('Unit 3 test');
    await post.getByLabel(t('pdfPost.dueDate')).fill('2026-12-01');
    await post
      .getByLabel(t('pdfPost.file'))
      .setInputFiles({ name: 'unit-3.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
    await post.getByRole('button', { name: t('pdfPost.submit') }).click();

    await expect(card.getByRole('status')).toContainText(t('pdfPost.posted'));
    await expect(card.getByRole('link', { name: t('pdfPost.open') })).toHaveAttribute(
      'href',
      /^https:\/\/classroom\.local\//,
    );
  });

  test(`a test PDF from the AI assistant goes to Google Classroom and Google Forms (${locale})`, async ({
    page,
  }) => {
    // Waits for the worker to read the PDF.
    test.setTimeout(90_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();

    await page.goto(`/${locale}/app/assistant`);
    const card = page.getByRole('region', { name: t('pdfTest.title') });
    await card.getByText(t('pdfPost.aiInstead')).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#pdf-test-card')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await card
      .getByLabel(t('pdfTest.target'))
      .selectOption({ label: `Historia 6 · ${t('gradebook.standard_test')}` });
    await card.getByLabel(t('pdfTest.name')).fill('Space quiz');
    await card
      .getByLabel(t('pdfTest.file'))
      .setInputFiles({ name: 'quiz.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
    await card.getByRole('button', { name: t('pdfTest.submit') }).click();

    await expect(page.getByRole('note')).toHaveText(t('questions.imported'), { timeout: 30_000 });
    const builder = page.getByRole('form', { name: t('questions.title') });
    await expect(builder.getByRole('listitem')).toHaveCount(3);
    await builder.getByRole('button', { name: t('questions.save') }).click();
    await expect(page).toHaveURL(/\/questions\?saved=1$/);
    await page.getByRole('link', { name: t('pdfTest.sendTitle') }).click();
    await expect(page).toHaveURL(/#send-to-google$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Space quiz');
    const questionsUrl = page.url();

    const send = page.getByRole('region', { name: t('pdfTest.sendTitle') });
    await send.getByRole('link', { name: t('pdfTest.connect') }).click();
    await expect(
      page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
    ).toBeVisible();
    await page.goto(questionsUrl);

    const share = page.getByRole('form', { name: t('classroom.share') });
    await share.getByRole('button', { name: t('classroom.share') }).click();
    await expect(share.getByRole('status')).toContainText(t('classroom.shared'));

    const forms = page.getByRole('form', { name: t('forms.make') });
    await forms.getByRole('button', { name: t('forms.make') }).click();
    await expect(forms.getByRole('status')).toContainText(t('forms.made'));
    await expect(forms.getByRole('link', { name: t('forms.edit') })).toHaveAttribute(
      'href',
      /^https:\/\/forms\.local\/d\/local-form-\d+\/edit$/,
    );

    await page.reload();
    const quiz = page.getByRole('region', { name: t('forms.title') });
    await expect(quiz.getByRole('link', { name: t('forms.studentLink') })).toHaveAttribute(
      'href',
      /viewform$/,
    );
    await expect(quiz.getByRole('button', { name: t('forms.remake') })).toBeVisible();
  });

  test(`a teacher with no class turns a test PDF into a Google Forms quiz and posts it to Classroom (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUp(page, locale);

    await page.goto(`/${locale}/app/assistant`);
    const card = page.getByRole('region', { name: t('pdfTest.title') });
    await card.getByText(t('pdfPost.aiInstead')).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#pdf-test-card')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(card.getByLabel(t('pdfTest.target'))).toHaveValue('');
    await card.getByLabel(t('pdfTest.name')).fill('Space quiz');
    await card
      .getByLabel(t('pdfTest.file'))
      .setInputFiles({ name: 'quiz.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
    await card.getByRole('button', { name: t('pdfTest.submit') }).click();

    await expect(page.getByRole('note')).toHaveText(t('questions.imported'), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Space quiz');
    const reviewUrl = page.url();
    await page.getByRole('link', { name: t('pdfTest.connect') }).click();
    await expect(
      page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
    ).toBeVisible();

    await page.goto(reviewUrl);
    const builder = page.getByRole('form', { name: t('questions.title') });
    await expect(builder.getByRole('listitem')).toHaveCount(3);
    await builder.getByRole('button', { name: t('forms.make') }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Space quiz');
    await expect(page.getByRole('link', { name: t('forms.edit') })).toHaveAttribute(
      'href',
      /^https:\/\/forms\.local\/d\/local-form-\d+\/edit$/,
    );
    const post = page.getByRole('form', { name: t('googleQuiz.post') });
    await post.getByLabel(t('googleQuiz.dueDate')).fill('2026-12-01');
    await post.getByRole('button', { name: t('googleQuiz.post') }).click();
    await expect(post.getByRole('status')).toContainText(t('googleQuiz.posted'));

    await page.getByRole('link', { name: t('googleQuiz.back') }).click();
    await expect(
      page
        .getByRole('list', { name: t('googleQuiz.list') })
        .getByRole('link', { name: 'Space quiz' }),
    ).toBeVisible();
  });
}
