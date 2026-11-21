import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/**
 * A class where Ana's family reads Chinese (from the roster file) and Ben's French (set on the
 * student form), with the standard grade categories.
 */
async function classWithFamilyLanguages(page: Page, locale: Locale, emails: readonly string[]) {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Historia 7');
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia 7');
  const classPath = new URL(page.url()).pathname;
  const roster = page.getByRole('form', { name: t('students.importTitle') });
  await roster.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `First name,Last name,Parent email,Family language\nAna,Zayas,${emails[0] ?? ''},Chinese\nBen,Acosta,${emails[1] ?? ''},\n`,
      'utf8',
    ),
  });
  await roster.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 2 }));

  await page.getByRole('link', { name: `${t('students.edit')} Ben Acosta` }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('students.editTitle'));
  await page.getByLabel(t('students.familyLanguage')).selectOption({ label: 'Français' });
  await page.getByRole('button', { name: t('students.save') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia 7');

  await page.goto(`${classPath}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
  await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`each family gets the weekly email in its language, checked by the teacher (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const stamp = `${locale}${String(Date.now())}`;
    const emails = [`ana.${stamp}@example.com`, `ben.${stamp}@example.com`];
    await signUp(page, locale);
    await classWithFamilyLanguages(page, locale, emails);

    await page.getByRole('link', { name: t('nav.prep'), exact: true }).click();
    const form = page.getByRole('form', { name: t('prep.newTitle') });
    await form.getByLabel(t('prep.prompt')).fill('Unit 3: the Civil War');
    await form.getByLabel(t('prep.days')).fill('2');
    await form.getByLabel(t('prep.subject'), { exact: true }).selectOption('social_studies');
    await form.getByLabel(t('prep.grade'), { exact: true }).selectOption('7');
    await form
      .getByLabel(t('prep.quizCategory'))
      .selectOption({ label: t('gradebook.standard_quiz') });
    await form.getByRole('button', { name: t('prep.start') }).click();
    await expect(page.getByTestId('prep-status')).toHaveText(t('prep.status_ready'), {
      timeout: 60_000,
    });

    // The teacher sees which languages the families read, and asks for drafts.
    const review = page.getByRole('form', { name: t('prep.review') });
    const translations = review.getByTestId('prep-translations');
    await expect(translations).toContainText(
      t('prep.familyLanguages', { languages: 'Français (1), 中文 (1)' }),
    );
    await review.getByLabel(t('prep.emailSubjectLabel'), { exact: true }).fill(`Week 3 ${stamp}`);
    await review.getByRole('button', { name: t('prep.translate') }).click();
    const chinese = review.getByRole('region', {
      name: t('prep.translationHeading', { language: '中文' }),
    });
    await expect(chinese).toBeVisible({ timeout: 60_000 });
    await expect(
      review.getByRole('region', { name: t('prep.translationHeading', { language: 'Français' }) }),
    ).toBeVisible();
    // The edited English or Spanish email was kept while translating.
    await expect(review.getByLabel(t('prep.emailSubjectLabel'), { exact: true })).toHaveValue(
      `Week 3 ${stamp}`,
    );
    expect(await axe(page)).toEqual([]);

    // The teacher corrects the Chinese draft, then publishes.
    await chinese
      .getByLabel(t('prep.translationSubject', { language: '中文' }))
      .fill(`第3周 ${stamp}`);
    await review.getByRole('button', { name: t('prep.publish') }).click();
    await expect(page.getByTestId('prep-status')).toHaveText(t('prep.status_published'));
    await expect(page.getByTestId('prep-emails')).toHaveText(t('prep.emailsSent', { count: 2 }));

    // Ana's family got the corrected Chinese email; Ben's the French draft.
    await page.goto(`/${locale}/dev/mail`);
    const mailTo = (email: string) =>
      page
        .getByRole('article')
        .filter({ hasText: `To ${email}` })
        .first();
    await expect(mailTo(emails[0] ?? '')).toContainText(`第3周 ${stamp}`);
    await expect(mailTo(emails[1] ?? '')).toContainText('Cette semaine en classe');
  });
}
