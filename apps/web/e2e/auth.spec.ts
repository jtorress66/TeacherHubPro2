import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { appPath, logIn, password, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test.describe(`accounts (${locale})`, () => {
    test('a teacher signs up and gets their own school on a 7-day free trial', async ({ page }) => {
      await signUp(page, locale);

      await expect(page.getByTestId('school-name')).toHaveText(t('defaults.schoolName'));
      await expect(page.getByTestId('plan-badge')).toHaveText(
        t('dashboard.trialDaysLeft', { days: 7 }),
      );
    });

    test('a teacher logs out and back in', async ({ page }) => {
      const email = await signUp(page, locale);

      await page.getByRole('button', { name: t('nav.logOut') }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await page.goto(`/${locale}/app`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));

      await logIn(page, locale, email);
      await expect(page).toHaveURL(appPath(locale));
    });

    test('a wrong password is refused without saying whether the account exists', async ({
      page,
    }) => {
      const email = await signUp(page, locale);
      await page.getByRole('button', { name: t('nav.logOut') }).click();

      await logIn(page, locale, email, 'not the password');
      await expect(page.getByText(t('errors.invalid_credentials'))).toBeVisible();
      await logIn(page, locale, `nobody-${email}`, password);
      await expect(page.getByText(t('errors.invalid_credentials'))).toBeVisible();
    });

    test('an email can only have one account', async ({ page }) => {
      const email = await signUp(page, locale);
      await page.getByRole('button', { name: t('nav.logOut') }).click();

      await page.goto(`/${locale}/signup`);
      await page.getByLabel(t('auth.name'), { exact: true }).fill('Someone Else');
      await page.getByLabel(t('auth.email'), { exact: true }).fill(email.toUpperCase());
      await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
      await page.getByRole('button', { name: t('auth.createAccount') }).click();
      await expect(page.getByText(t('errors.email_taken'))).toBeVisible();
    });

    test('a short password is explained', async ({ page }) => {
      await page.goto(`/${locale}/signup`);
      await page.getByLabel(t('auth.name'), { exact: true }).fill('Ana');
      await page.getByLabel(t('auth.email'), { exact: true }).fill('short@school.edu');
      await page.getByLabel(t('auth.password'), { exact: true }).fill('short');
      await page.getByRole('button', { name: t('auth.createAccount') }).click();
      await expect(page.getByText(t('errors.passwordTooShort'))).toBeVisible();
    });
  });
}

test('settings save the school name and a new language switches the app to it', async ({
  page,
}) => {
  const en = createTranslator('en');
  const es = createTranslator('es');
  await signUp(page, 'en');
  await page.getByRole('link', { name: en('nav.settings') }).click();

  await page.getByLabel(en('settings.schoolName')).fill('Escuela Luz');
  await page
    .getByRole('region', { name: en('settings.school') })
    .getByRole('button', { name: en('settings.save') })
    .click();
  await expect(
    page.getByRole('region', { name: en('settings.school') }).getByRole('status'),
  ).toHaveText(en('settings.saved'));

  await page.getByLabel(en('settings.language')).selectOption('es');
  await page
    .getByRole('region', { name: en('settings.profile') })
    .getByRole('button', { name: en('settings.save') })
    .click();
  await expect(page).toHaveURL(/\/es\/app\/settings$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(es('settings.title'));
  await expect(page.getByTestId('school-name')).toHaveText('Escuela Luz');
});
