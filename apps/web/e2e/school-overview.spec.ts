import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`the account owner sees the school's use and turns AI and student flags off and on (${locale})`, async ({
    page,
  }) => {
    const t = createTranslator(locale);
    await signUp(page, locale);
    await page.getByRole('button', { name: t('sample.add') }).click();
    await expect(page.getByTestId('sample-notice')).toBeVisible();

    await page.getByRole('link', { name: t('nav.schoolOverview') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('schoolOverview.title'));
    await expect(page.getByTestId('usage-row')).toHaveCount(1);
    await expect(page.getByTestId('usage-row')).toContainText('Ana López');

    const switches = page.getByRole('region', { name: t('schoolOverview.switchesTitle') });
    const save = async () => {
      await switches.getByRole('button', { name: t('schoolOverview.save') }).click();
      await expect(switches.getByRole('status')).toHaveText(t('schoolOverview.saved'));
    };

    // AI off: drafting is refused, with the reason.
    await switches.getByLabel(t('schoolOverview.ai')).uncheck();
    await save();
    await page.goto(`/${locale}/app/assistant`);
    const form = page.getByRole('form', { name: t('assistant.title') });
    await form.getByLabel(t('assistant.type')).selectOption('worksheet');
    await form.getByLabel(t('assistant.topic')).fill('Fractions');
    await form.getByRole('button', { name: t('assistant.submit') }).click();
    await expect(form).toContainText(t('errors.ai_off_for_school'));

    // Student flags off: nobody is listed as needing help.
    const atRisk = page.getByRole('heading', { name: t('commandCenter.atRisk'), exact: true });
    await page.goto(`/${locale}/app`);
    await expect(atRisk).toBeVisible();
    await page.goto(`/${locale}/app/school`);
    await switches.getByLabel(t('schoolOverview.studentFlags')).uncheck();
    await save();
    await page.goto(`/${locale}/app`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(atRisk).toHaveCount(0);

    // Both back on.
    await page.goto(`/${locale}/app/school`);
    await switches.getByLabel(t('schoolOverview.ai')).check();
    await switches.getByLabel(t('schoolOverview.studentFlags')).check();
    await save();
    await page.goto(`/${locale}/app`);
    await expect(atRisk).toBeVisible();
  });
}
