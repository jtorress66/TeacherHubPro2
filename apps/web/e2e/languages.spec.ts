import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

// The languages translated beyond English and Spanish: the site, Chat with Ed and the app speak
// them on every page.
for (const locale of ['fr', 'pt', 'de', 'it', 'zh'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`the site, Chat with Ed and the app are in this language (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('home.title'));

    await page.getByRole('button', { name: t('marketing.chat.open') }).click();
    const chat = page.getByRole('region', { name: t('marketing.chat.title') });
    await expect(chat).toContainText(t('marketing.chat.intro'));
    await expect(
      chat.getByRole('button', { name: t('marketing.roles.teacher'), exact: true }),
    ).toBeVisible();

    await signUp(page, locale);
    await expect(page.getByRole('link', { name: t('nav.rubrics'), exact: true })).toBeVisible();
    await page.getByRole('link', { name: t('nav.rubrics'), exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('rubrics.heading'));
  });
}
