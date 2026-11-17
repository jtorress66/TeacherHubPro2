import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a new teacher tries the app on the sample class, then removes it (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.getByRole('button', { name: t('sample.add') }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('sample.className'));
    await expect(page.getByTestId('sample-notice')).toHaveText(t('sample.notice'));
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(7);

    // The Command Center has an answer to review and one student who may need help.
    await page.goto(`/${locale}/app`);
    await expect(page.getByRole('region', { name: t('sample.tryTitle') })).toHaveCount(0);
    const atRisk = page.getByRole('list', { name: t('commandCenter.atRisk') });
    await expect(atRisk.getByRole('listitem')).toHaveCount(1);
    await expect(atRisk).toContainText(`${t('sample.student3')} K.`);

    // The AI's suggestion waits for the teacher, who decides.
    await page
      .getByRole('region', { name: t('commandCenter.toGrade') })
      .getByRole('link', { name: t('sample.onlineQuiz') })
      .click();
    await page.getByRole('link', { name: t('questions.submissions') }).click();
    const answer = page.getByTestId('submission-R.');
    await expect(answer).toContainText(t('grading.status_ai_graded'));
    await expect(answer).toContainText(t('grading.draft', { score: 9, max: 10 }));
    await answer.getByRole('button', { name: t('grading.confirm') }).click();
    await expect(answer).toContainText(t('grading.confirmed', { score: 9, max: 10 }));

    // Removing it takes it out of the list and offers it again.
    await page.goto(`/${locale}/app/classes`);
    await page.getByRole('link', { name: t('sample.className') }).click();
    await page.getByRole('button', { name: t('sample.remove') }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/app/classes$`));
    await expect(page.getByRole('link', { name: t('sample.className') })).toHaveCount(0);
    await expect(page.getByRole('button', { name: t('sample.add') })).toBeVisible();
  });
}
