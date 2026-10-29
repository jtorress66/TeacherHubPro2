import { expect, test } from '@playwright/test';
import { createTranslator } from '@thp/i18n';
import { signUp } from './helpers.ts';

const t = createTranslator('en');

test('the checklist ticks school information and the first class, then hides itself', async ({
  page,
}) => {
  await signUp(page, 'en');
  await expect(page.getByTestId('onboarding-progress')).toHaveText(
    t('onboarding.progress', { done: 0, total: 2 }),
  );

  await page.getByRole('link', { name: t('onboarding.firstClass') }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Math 7');
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Math 7');
  await page.getByRole('link', { name: t('nav.dashboard') }).click();
  await expect(page.getByTestId('onboarding-progress')).toHaveText(
    t('onboarding.progress', { done: 1, total: 2 }),
  );

  await page.getByRole('link', { name: t('onboarding.schoolInfo') }).click();
  await page.getByLabel(t('settings.schoolName')).fill('Lincoln Middle School');
  await page
    .getByRole('region', { name: t('settings.school') })
    .getByRole('button', { name: t('settings.save') })
    .click();
  await expect(
    page.getByRole('region', { name: t('settings.school') }).getByRole('status'),
  ).toBeVisible();
  await page.getByRole('link', { name: t('nav.dashboard') }).click();
  await expect(page.getByRole('heading', { name: t('onboarding.title') })).toHaveCount(0);
});

test('the checklist can be dismissed', async ({ page }) => {
  await signUp(page, 'en');
  await page.getByRole('button', { name: t('onboarding.dismiss') }).click();

  await expect(page.getByRole('heading', { name: t('onboarding.title') })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: t('onboarding.title') })).toHaveCount(0);
});

test('the welcome tour shows once, steps through, and does not come back', async ({ page }) => {
  const es = createTranslator('es');
  await signUp(page, 'es', undefined, { tour: true });

  const tour = page.getByRole('dialog', { name: es('tour.welcomeTitle') });
  await expect(tour).toBeVisible();
  await page.getByRole('button', { name: es('tour.next') }).click();
  await expect(page.getByRole('heading', { name: es('tour.classesTitle') })).toBeVisible();
  await page.getByRole('button', { name: es('tour.next') }).click();
  await page.getByRole('button', { name: es('tour.next') }).click();
  await page.getByRole('button', { name: es('tour.done') }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('plan-badge')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
