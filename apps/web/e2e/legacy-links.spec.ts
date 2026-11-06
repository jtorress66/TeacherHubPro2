import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { importLegacyExport } from './database.ts';
import { logIn, skipTour } from './helpers.ts';

// Build step 19 gate: data carried over from the old app works in the new one. The export is a
// small synthetic one (fake people), imported through `pnpm migrate:legacy --apply`.
test.beforeAll(() => {
  importLegacyExport();
});

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a migrated teacher logs in with their old password and finds their class (${locale})`, async ({
    page,
  }) => {
    await skipTour(page);
    await logIn(page, locale, 'legacy.teacher@example.edu', 'my old password');
    await expect(page).toHaveURL(new RegExp(`/${locale}/app`));
    await page.goto(`/${locale}/app/classes`);
    await expect(page.getByRole('link', { name: /Ciencias 5/u }).first()).toBeVisible();
  });

  test(`an old family portal link opens the family portal (${locale})`, async ({ page }) => {
    await page.goto(`/portal/portal_legacy0e2e0family0link?lang=${locale}`);

    await expect(page).toHaveURL(`/${locale}/p/portal_legacy0e2e0family0link`);
    await expect(
      page.getByRole('heading', { name: t('family.title', { name: 'Tomás Prueba' }) }),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: t('family.grades') })).toContainText(
      'Ciclo del agua',
    );
  });

  test(`an old assignment link asks for the student's new link (${locale})`, async ({ page }) => {
    await page.goto(`/assignment/legacy0assign1?lang=${locale}`);

    await expect(page).toHaveURL(`/${locale}/old-link`);
    await expect(page.getByRole('heading', { name: t('oldLink.title') })).toBeVisible();
    await expect(page.getByText(t('oldLink.action'))).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
  });
}
