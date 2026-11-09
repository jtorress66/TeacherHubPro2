import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp, studentLink } from './helpers.ts';

/** The local stand-in asks "Which number is larger: A or B?"; this answers it (or not). */
async function answerCheck(student: Page, n: number, right: boolean) {
  const question = student.getByRole('group', { name: new RegExp(`^${String(n)}\\. `, 'u') });
  const numbers = ((await question.locator('legend').textContent()) ?? '').match(/\d+/gu) ?? [];
  const [, smaller = '', larger = ''] = numbers;
  await question.getByRole('button', { name: right ? larger : smaller, exact: true }).click();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 13 gate: a path is generated → the student completes a lesson → progress updates.
  test(`a teacher drafts a learning path, the student completes a lesson, progress updates (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    const link = await studentLink(page, locale, classPath, 'Ana');

    await page.goto(`/${locale}/app/learning`);
    const form = page.getByRole('form', { name: t('learning.draftTitle') });
    await form.getByLabel(t('learning.student')).selectOption({ label: 'Ana Zayas' });
    await form.getByLabel(t('learning.topic')).fill('Comparing numbers');
    await form.getByLabel(t('learning.lessonCount')).fill('3');
    await form.getByLabel(t('esl.label')).check();
    await form.getByRole('button', { name: t('learning.draft') }).click();

    const drafts = page.getByRole('list', { name: t('learning.toReview') });
    await expect(drafts.getByRole('link')).toHaveText('Local learning path', { timeout: 30_000 });

    // A draft is not on the student's link.
    const student = await (await browser.newContext()).newPage();
    await student.goto(link);
    await expect(student.getByRole('heading', { level: 1 })).toHaveText(
      t('student.hello', { name: 'Ana' }),
    );
    await expect(student.getByRole('heading', { name: t('learning.yourPaths') })).toHaveCount(0);

    // The teacher reviews, edits a check and assigns the path.
    await drafts.getByRole('link').click();
    const editor = page.getByRole('form', { name: t('learning.edit') });
    await editor
      .locator('#lesson-0-check-0-prompt')
      .fill('Which number is larger: 11 or 12? Look closely.');
    await editor.getByRole('button', { name: t('learning.save') }).click();
    await expect(page.getByRole('status').filter({ hasText: t('learning.saved') })).toBeVisible();
    await page.getByRole('button', { name: t('learning.assign') }).click();
    await expect(page.getByText(t('learning.status_assigned'), { exact: true })).toBeVisible();

    // The student opens the path, reads lesson 1 and answers its check, one wrong on purpose.
    await student.reload();
    await student.getByRole('link', { name: 'Local learning path' }).click();
    await student.getByRole('link', { name: 'Local lesson 1' }).click();
    await expect(student.getByRole('heading', { level: 1 })).toHaveText('Local lesson 1');
    expect(
      await new AxeBuilder({ page: student }).withTags(['wcag2a', 'wcag2aa']).analyze(),
    ).toMatchObject({ violations: [] });
    await answerCheck(student, 1, true);
    await answerCheck(student, 2, false);
    await answerCheck(student, 3, true);
    await student.getByRole('button', { name: t('learning.submit') }).click();
    await expect(student.getByRole('status')).toHaveText(
      t('learning.score', { score: 2, total: 3, percent: 67 }),
    );
    await expect(student.getByText(t('learning.correction', { n: 2, right: '13' }))).toBeVisible();

    await student.goto(link);
    await expect(
      student.getByText(t('learning.progressLabel', { done: 1, total: 3 })),
    ).toBeVisible();

    // The teacher's progress shows it.
    await page.goto(`/${locale}/app/learning`);
    const ana = page
      .getByRole('table', { name: t('learning.progress') })
      .getByRole('row')
      .filter({
        hasText: 'Ana',
      });
    await expect(ana).toContainText(t('learning.lessonsOf', { done: 1, total: 3 }));
    await expect(ana).toContainText('67%');
    await expect(ana).toContainText(
      t('learning.levelOf', { subject: t('assistant.subject_math'), level: 3 }),
    );
    await student.context().close();
  });
}
