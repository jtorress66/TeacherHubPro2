import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { continueWithGoogle, signUp, uniqueEmail } from './helpers.ts';

/** Text from the catalog with any non-breaking spaces made ordinary, as Playwright sees them. */
const normalize = (text: string) => text.replaceAll(String.fromCharCode(160), ' ');

async function choosePlan(
  page: Page,
  locale: Locale,
  planKey: 'school' | 'individual_monthly',
  teachers?: number,
) {
  const t = createTranslator(locale);
  const plan = t(`plans.${planKey}`);
  await page.getByRole('link', { name: t('nav.billing') }).click();
  const form = page.getByRole('form', { name: plan });
  if (teachers !== undefined) await form.getByLabel(t('billing.teachers')).fill(String(teachers));
  await form.getByRole('button', { name: t('billing.choose', { plan }) }).click();
}

// Build step 4 gate: sign up → school created → buy a plan.
test('a teacher signs up with email and buys the School plan for 12 teachers', async ({ page }) => {
  const t = createTranslator('es');
  await signUp(page, 'es');
  await expect(page.getByTestId('school-name')).toHaveText(t('defaults.schoolName'));

  await choosePlan(page, 'es', 'school', 5);
  await expect(page.getByText(t('errors.below_minimum_seats'))).toBeVisible();

  await choosePlan(page, 'es', 'school', 12);
  await expect(page.getByText(t('checkout.testMode'))).toBeVisible();
  await expect(
    page.getByText(normalize(t('checkout.total', { price: '864,00 US$' }))),
  ).toBeVisible();
  await page.getByRole('button', { name: /864,00/ }).click();

  await expect(page.getByRole('status')).toHaveText(t('billing.checkoutSuccess'));
  const badge = t('plans.seats', { plan: t('plans.school'), count: 12 });
  await expect(page.getByTestId('current-plan')).toHaveText(
    t('billing.currentPlan', { plan: badge }),
  );
  await page.getByRole('link', { name: t('nav.dashboard') }).click();
  await expect(page.getByTestId('plan-badge')).toHaveText(badge);
});

test('a teacher who signed up with Google buys the Individual monthly plan', async ({ page }) => {
  const t = createTranslator('en');
  await continueWithGoogle(page, 'en', uniqueEmail('google'));

  await choosePlan(page, 'en', 'individual_monthly');
  await expect(page.getByText(t('checkout.testMode'))).toBeVisible();
  await page.getByRole('button', { name: t('checkout.pay', { price: '$9.99' }) }).click();

  await expect(page.getByRole('status')).toHaveText(t('billing.checkoutSuccess'));
  await page.getByRole('link', { name: t('nav.dashboard') }).click();
  await expect(page.getByTestId('plan-badge')).toHaveText(t('plans.individual_monthly'));
});

test('cancelling the checkout charges nothing and keeps the trial', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');

  await choosePlan(page, 'en', 'individual_monthly');
  await page.getByRole('link', { name: t('checkout.cancel') }).click();

  await expect(page.getByRole('status')).toHaveText(t('billing.checkoutCanceled'));
  await expect(page.getByText(t('billing.onTrial', { days: 7 }))).toBeVisible();
});
