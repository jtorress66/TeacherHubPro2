import { expect, test } from '@playwright/test';
import { catalogs } from '@thp/i18n';

test.describe('home page languages', () => {
  test('/es renders the Spanish title and html lang=es', async ({ page }) => {
    await page.goto('/es');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('/en renders the English title and html lang=en', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.en.home.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('/ redirects to /en with no preferences', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.en.home.title);
  });

  test('/?lang=es redirects to /es and remembers it: the next visit to / goes to /es', async ({
    page,
  }) => {
    await page.goto('/?lang=es');
    await expect(page).toHaveURL(/\/es$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);
  });

  test('/fr renders English text with html lang=fr', async ({ page }) => {
    await page.goto('/fr');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.en.home.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('the language picker switches between /en and /es', async ({ page }) => {
    await page.goto('/en');
    const picker = page.getByRole('navigation', { name: catalogs.en.language.label });
    await expect(picker.getByRole('link')).toHaveCount(7);

    await picker.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);

    await page
      .getByRole('navigation', { name: catalogs.es.language.label })
      .getByRole('link', { name: 'English' })
      .click();
    await expect(page).toHaveURL(/\/en$/);
  });
});
