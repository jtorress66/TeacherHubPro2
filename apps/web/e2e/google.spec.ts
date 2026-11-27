import { expect, test } from '@playwright/test';
import { createTranslator } from '@thp/i18n';
import { continueWithGoogle, uniqueEmail } from './helpers.ts';

test('Google sign-in creates an account with its own school, and signs in to it again later', async ({
  page,
}) => {
  const t = createTranslator('es');
  const email = uniqueEmail('google');

  await continueWithGoogle(page, 'es', email);
  await expect(page.getByTestId('school-name')).toHaveText(t('defaults.schoolName'));
  await expect(page.getByTestId('plan-badge')).toHaveText(
    t('dashboard.trialDaysLeft', { days: 7 }),
  );

  await page.getByRole('link', { name: t('nav.settings') }).click();
  const renamed = `Colegio ${email.slice(7, 15)}`;
  await page.getByLabel(t('settings.schoolName')).fill(renamed);
  await page
    .getByRole('region', { name: t('settings.school') })
    .getByRole('button', { name: t('settings.save') })
    .click();
  await expect(
    page.getByRole('region', { name: t('settings.school') }).getByRole('status'),
  ).toBeVisible();
  await page.getByRole('button', { name: t('nav.logOut') }).click();

  await continueWithGoogle(page, 'es', email);
  await expect(page.getByTestId('school-name')).toHaveText(renamed);
});

test('Google sign-in is refused when Google has not verified the email', async ({ page }) => {
  const t = createTranslator('en');
  await page.goto('/en/login');
  await page.getByRole('link', { name: t('auth.continueWithGoogle') }).click();
  await page.getByLabel(t('localGoogle.email')).fill(uniqueEmail('unverified'));
  await page.getByLabel(t('localGoogle.verified')).uncheck();
  await page.getByRole('button', { name: t('localGoogle.continue') }).click();

  await expect(page).toHaveURL(/\/en\/login\?error=google_email_unverified$/);
  await expect(page.getByText(t('errors.google_email_unverified'))).toBeVisible();
});

test('the Google apps menu shortcut signs in with one click, then opens the dashboard', async ({
  page,
}) => {
  const t = createTranslator('es');
  await page.goto('/es'); // A visitor who chose Spanish on the site.

  // Signed out: straight to Google's account picker, no log-in page in between.
  await page.goto('/api/auth/google/launch');
  await expect(page.getByRole('heading', { name: t('localGoogle.title') })).toBeVisible();
  await page.getByLabel(t('localGoogle.email')).fill(uniqueEmail('launch'));
  await page.getByLabel(t('localGoogle.name')).fill('Ana Google');
  await page.getByRole('button', { name: t('localGoogle.continue') }).click();
  await expect(page.getByTestId('school-name')).toHaveText(t('defaults.schoolName'));

  // Signed in: the shortcut opens the dashboard in the saved language.
  await page.goto('/api/auth/google/launch');
  await expect(page).toHaveURL(/\/es\/app$/);
  await expect(page.getByTestId('school-name')).toBeVisible();
});
