import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp, uniqueEmail } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`the account owner asks to delete all school data, then cancels (${locale})`, async ({
    page,
  }) => {
    const t = createTranslator(locale);
    await signUp(page, locale, uniqueEmail('deletion'));
    const schoolName = (await page.getByTestId('school-name').textContent())?.trim() ?? '';

    await page.getByRole('link', { name: t('nav.settings') }).click();
    const card = page.getByRole('region', { name: t('schoolDeletion.title') });
    const nameField = card.getByLabel(t('schoolDeletion.confirmLabel', { school: schoolName }));

    await nameField.fill('Not my school');
    await card.getByRole('button', { name: t('schoolDeletion.button') }).click();
    await expect(card).toContainText(t('errors.name_mismatch'));

    await nameField.fill(schoolName.toUpperCase());
    await card.getByRole('button', { name: t('schoolDeletion.button') }).click();
    // The notice's words before its date, which depends on the day the test runs.
    const [noticeStart = ''] = t('schoolDeletion.notice', { date: '|' }).split('|');
    const banner = page.getByRole('status').filter({ hasText: noticeStart });
    await expect(banner).toBeVisible();
    await expect(card.getByRole('button', { name: t('schoolDeletion.cancel') })).toBeVisible();

    // Everywhere in the app, until it is canceled.
    await page.getByRole('link', { name: t('nav.classes') }).click();
    await expect(banner).toBeVisible();

    await banner.getByRole('link', { name: t('schoolDeletion.manage') }).click();
    await card.getByRole('button', { name: t('schoolDeletion.cancel') }).click();
    await expect(card).toContainText(t('schoolDeletion.canceled'));
    await expect(banner).toHaveCount(0);
    await expect(card.getByRole('button', { name: t('schoolDeletion.button') })).toBeVisible();
  });
}
