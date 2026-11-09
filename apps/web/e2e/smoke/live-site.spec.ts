import { expect, test } from '@playwright/test';
import { createTranslator } from '@thp/i18n';

// The live site, read only: nothing here signs up, pays or sends Ed a message.

test('the web app is up', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toEqual({ ok: true });
});

for (const locale of ['en', 'es'] as const) {
  const t = createTranslator(locale);

  test(`the website, prices, login and Chat with Ed work (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('home.title'));
    await expect(page.getByTestId('plan-individual_monthly')).toContainText(/9[.,]99/u);

    await page.getByRole('button', { name: t('marketing.chat.open') }).click();
    await expect(page.getByRole('region', { name: t('marketing.chat.title') })).toContainText(
      t('marketing.chat.intro'),
    );

    await page.goto(`/${locale}/pricing`);
    await expect(page.getByTestId('plan-individual_yearly')).toContainText('79');

    await page.goto(`/${locale}/login`);
    await expect(page.getByRole('button', { name: t('auth.logIn'), exact: true })).toBeVisible();
  });
}

test('an old app address still lands on the right page', async ({ page }) => {
  await page.goto('/dashboard?lang=en');
  await expect(page).toHaveURL(/\/en\/login/);
});
