import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { endTrialOf, makeSuperAdmin } from './database.ts';
import { signUp, uniqueEmail } from './helpers.ts';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/** A message's text before its date, so a test can tell "ends on" from "ended on". */
const beforeDate = (message: string) => message.split('{date}')[0]?.trim() ?? message;

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a super admin extends a school's ended trial, and its teacher is back in (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    // A teacher, such as an app reviewer, whose 7-day trial ended.
    const reviewerEmail = await signUp(page, locale, uniqueEmail('reviewer'));
    const schoolId = await endTrialOf(reviewerEmail);
    await page.goto(`/${locale}/app`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/app/billing`));

    // The super admin sees the trial ended and gives 30 more days.
    const root = await (await browser.newContext()).newPage();
    await makeSuperAdmin(await signUp(root, locale, uniqueEmail('root')));
    await root.goto(`/${locale}/app/super-admin/schools/${schoolId}`);
    const trial = root.getByRole('region', { name: t('superAdmin.trialHeading') });
    await expect(trial).toContainText(beforeDate(t('superAdmin.trialEnded')));
    const form = trial.getByRole('form', { name: t('superAdmin.extendTrial') });

    await form.getByLabel(t('superAdmin.trialDays')).fill('91');
    await form.getByRole('button', { name: t('superAdmin.extendTrial') }).click();
    await expect(form.getByLabel(t('superAdmin.trialDays'))).toHaveAccessibleDescription(/90/u);

    await form.getByLabel(t('superAdmin.trialDays')).fill('30');
    await form.getByRole('button', { name: t('superAdmin.extendTrial') }).click();
    await expect(form.getByRole('status')).toHaveText(t('superAdmin.trialExtended'));
    await expect(trial).toContainText(beforeDate(t('superAdmin.trialEnds')));
    await expect(
      root.getByRole('cell', { name: t('activity.action_school_trial_extended') }),
    ).toBeVisible();
    expect(await axe(root)).toEqual([]);

    // The teacher has the app again.
    await page.goto(`/${locale}/app`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/app$`));
    await expect(page.getByTestId('plan-badge')).toHaveText(
      t('dashboard.trialDaysLeft', { days: 30 }),
    );
  });
}
