import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/** A class with two students whose families have an email, and the standard grade categories. */
async function classWithFamilies(page: Page, locale: Locale, emails: readonly string[]) {
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
      `First name,Last name,Parent email\nAna,Zayas,${emails[0] ?? ''}\nBen,Acosta,${emails[1] ?? ''}\n`,
      'utf8',
    ),
  });
  await roster.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 2 }));
  await page.goto(`${classPath}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
  await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const worksheet = (day: 'Mon' | 'Tue') =>
    t('prep.item_worksheet', { day: t(`planner.day_${day}`) });

  // Build step 16 gate: prompt → batch ready → the teacher approves → plans and quiz saved.
  test(`the prep agent drafts a week that the teacher reviews and publishes (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const stamp = `${locale}${String(Date.now())}`;
    const emails = [`ana.${stamp}@example.com`, `ben.${stamp}@example.com`];
    await signUp(page, locale);
    await classWithFamilies(page, locale, emails);

    await page.getByRole('link', { name: t('nav.prep'), exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('prep.title'));
    const form = page.getByRole('form', { name: t('prep.newTitle') });
    await form.getByLabel(t('prep.prompt')).fill('Unit 3: the Civil War');
    await form.getByLabel(t('prep.days')).fill('2');
    await form.getByLabel(t('prep.subject'), { exact: true }).selectOption('social_studies');
    await form.getByLabel(t('prep.grade'), { exact: true }).selectOption('7');
    await form
      .getByLabel(t('prep.quizCategory'))
      .selectOption({ label: t('gradebook.standard_quiz') });
    expect(await axe(page)).toEqual([]);
    await form.getByRole('button', { name: t('prep.start') }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unit 3: the Civil War');
    await expect(page.getByTestId('prep-status')).toHaveText(t('prep.status_ready'), {
      timeout: 60_000,
    });
    await expect(page.getByTestId('nav-badge')).toHaveText('1');

    const review = page.getByRole('form', { name: t('prep.review') });
    // The plan's day notes show their formatting (bold, a table), not the raw marks.
    const plan = page.getByRole('region', { name: `${t('prep.preview')}: ${t('prep.item_plan')}` });
    await expect(plan.getByRole('table').first()).toBeVisible();
    await expect(plan).not.toContainText('**');
    await review.getByRole('button', { name: `${t('prep.show')}: ${t('prep.item_quiz')}` }).click();
    const preview = page.getByRole('region', {
      name: `${t('prep.preview')}: ${t('prep.item_quiz')}`,
    });
    await expect(preview.getByRole('listitem').first()).toBeVisible();
    await review.getByLabel(t('prep.keep', { item: worksheet('Tue') })).uncheck();
    await expect(review).toContainText(t('prep.recipients', { count: 2 }));
    await review.getByLabel(t('prep.emailSubjectLabel')).fill(`Week 3 ${stamp}`);
    expect(await axe(page)).toEqual([]);
    await review.getByRole('button', { name: t('prep.publish') }).click();

    await expect(page.getByTestId('prep-status')).toHaveText(t('prep.status_published'));
    await expect(page.getByTestId('prep-emails')).toHaveText(t('prep.emailsSent', { count: 2 }));
    await expect(
      page.getByRole('link', { name: t('prep.openWorksheet', { number: 1 }) }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: t('prep.openWorksheet', { number: 2 }) }),
    ).toBeHidden();
    await expect(page.getByTestId('nav-badge')).toBeHidden();

    // The weekly plan and the Friday quiz are saved.
    const batch = page.url();
    await page.getByRole('link', { name: t('prep.openPlan') }).click();
    await expect(page).toHaveURL(/\/app\/plans\/[^/]+$/);
    await page.goto(batch);
    await page.getByRole('link', { name: t('prep.openQuiz') }).click();
    await expect(page).toHaveURL(/\/assignments\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Each family got the approved email.
    await page.goto(`/${locale}/dev/mail`);
    for (const email of emails) {
      await expect(
        page
          .getByRole('article')
          .filter({ hasText: `To ${email}` })
          .first(),
      ).toContainText(`Week 3 ${stamp}`);
    }
  });
}
