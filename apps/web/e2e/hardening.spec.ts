import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { makeSchoolAdmin } from './database.ts';
import { classWithStudents, logIn, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test.describe(`hardening for beta (${locale})`, () => {
    test('pages are sent with the security headers', async ({ request }) => {
      const reply = await request.get(`/${locale}`);

      expect(reply.headers()['x-frame-options']).toBe('DENY');
      expect(reply.headers()['x-content-type-options']).toBe('nosniff');
      expect(reply.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    test('password guessing on one account is stopped after five tries', async ({ page }) => {
      const email = await signUp(page, locale);
      await page.getByRole('button', { name: t('nav.logOut') }).click();

      for (let i = 0; i < 5; i += 1) {
        await logIn(page, locale, email, `wrong password ${String(i)}`);
        await expect(page.getByText(t('errors.invalid_credentials'))).toBeVisible();
      }
      await logIn(page, locale, email);
      await expect(page.getByText(t('errors.rate_limited'))).toBeVisible();
    });

    test("a school admin sees the school's activity", async ({ page }) => {
      const email = await signUp(page, locale);
      await makeSchoolAdmin(email);
      await classWithStudents(page, locale);

      await page.goto(`/${locale}/app/admin`);
      const activity = page.getByRole('table', { name: t('activity.title') });
      await expect(activity).toContainText(t('activity.action_students_imported'));
      await expect(activity).toContainText('Ana López');
    });
  });
}
