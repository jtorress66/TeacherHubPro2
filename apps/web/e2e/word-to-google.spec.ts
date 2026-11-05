import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

/** A Word document as the browser uploads it: a ZIP archive, which is all the app checks. */
const wordDocument = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(64)]);

async function connectGoogle(page: Page, locale: Locale): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/settings`);
  await page.getByRole('link', { name: t('classroom.connect') }).click();
  await expect(
    page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
  ).toBeVisible();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher posts a Word document to Google Classroom, a copy for each student (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.goto(`/${locale}/app/assistant`);
    const card = page.getByRole('region', { name: t('wordPost.title') });
    await expect(card.getByRole('link', { name: t('google.connect') })).toBeVisible();

    await connectGoogle(page, locale);
    await page.goto(`/${locale}/app/assistant`);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#word-post-card')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    const post = card.getByRole('form', { name: t('wordPost.submit') });
    await post.getByLabel(t('classroom.course')).selectOption({ label: 'Local Classroom course' });
    await post.getByLabel(t('wordPost.name')).fill('Unit 3 test');
    await post.getByLabel(t('wordPost.dueDate')).fill('2026-12-01');
    await post.getByLabel(t('wordPost.file')).setInputFiles({
      name: 'unit-3.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: wordDocument,
    });
    await post.getByRole('button', { name: t('wordPost.submit') }).click();

    await expect(card.getByRole('status')).toContainText(t('wordPost.posted'));
    await expect(card.getByRole('link', { name: t('wordPost.openClassroom') })).toHaveAttribute(
      'href',
      /^https:\/\/classroom\.local\//,
    );
    await expect(card.getByRole('link', { name: t('wordPost.openDoc') })).toHaveAttribute(
      'href',
      /^https:\/\/drive\.local\/file\/d\/local-file-\d+\/view$/,
    );
  });

  test(`an assignment's questions become a Google Forms quiz (${locale})`, async ({ page }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();
    const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
    await form.getByLabel(t('gradebook.assignmentTitle')).fill('Space quiz');
    await form
      .getByLabel(t('gradebook.category'), { exact: true })
      .selectOption({ label: t('gradebook.standard_test') });
    await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
    await page.getByRole('link', { name: 'Space quiz', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Space quiz');
    const assignmentPath = new URL(page.url()).pathname;

    await page.goto(`${assignmentPath}/questions`);
    const send = page.getByRole('region', { name: t('google.sendTitle') });
    await expect(send.getByRole('link', { name: t('google.connect') })).toBeVisible();
    await connectGoogle(page, locale);

    await page.goto(`${assignmentPath}/questions`);
    const builder = page.getByRole('form', { name: t('questions.title') });
    await page.getByLabel(t('questions.type')).selectOption('true_false');
    await page.getByRole('button', { name: t('questions.add') }).click();
    await builder.getByLabel(t('questions.prompt'), { exact: true }).fill('The Sun is a star.');
    await builder.getByRole('button', { name: t('questions.save') }).click();
    await expect(builder.getByRole('status')).toHaveText(t('questions.saved'));

    const quiz = page.getByRole('form', { name: t('forms.make') });
    await quiz.getByRole('button', { name: t('forms.make') }).click();
    await expect(quiz.getByRole('status')).toContainText(t('forms.made'));
    await page.reload();
    await expect(
      page.getByRole('region', { name: t('forms.title') }).getByRole('link', {
        name: t('forms.studentLink'),
      }),
    ).toHaveAttribute('href', /viewform$/);
  });
}
