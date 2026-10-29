import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';

export const password = 'correct horse battery staple';

/** A fresh address per test, so tests never collide in the shared database. */
export const uniqueEmail = (prefix = 'teacher') =>
  `${prefix}+${randomUUID().slice(0, 8)}@school.edu`;

export const appPath = (locale: Locale) => new RegExp(`/${locale}/app$`);

/** Marks the welcome tour as seen, so its dialog does not cover the page in other tests. */
export async function skipTour(page: Page): Promise<void> {
  await page
    .context()
    .addCookies([{ name: 'thp_tour_seen', value: '1', domain: 'localhost', path: '/' }]);
}

export async function signUp(
  page: Page,
  locale: Locale = 'en',
  email = uniqueEmail(),
  { tour = false }: { readonly tour?: boolean } = {},
): Promise<string> {
  const t = createTranslator(locale);
  if (!tour) await skipTour(page);
  await page.goto(`/${locale}/signup`);
  await page.getByLabel(t('auth.name'), { exact: true }).fill('Ana López');
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page).toHaveURL(appPath(locale));
  return email;
}

export async function logIn(
  page: Page,
  locale: Locale,
  email: string,
  withPassword = password,
): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/login`);
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(withPassword);
  await page.getByRole('button', { name: t('auth.logIn') }).click();
}

/** Signs in through the local stand-in for Google's account picker. */
export async function continueWithGoogle(
  page: Page,
  locale: Locale,
  email: string,
  name = 'Ana Google',
): Promise<void> {
  const t = createTranslator(locale);
  await skipTour(page);
  await page.goto(`/${locale}/login`);
  await page.getByRole('link', { name: t('auth.continueWithGoogle') }).click();
  await expect(page.getByRole('heading', { name: t('localGoogle.title') })).toBeVisible();
  await page.getByLabel(t('localGoogle.email')).fill(email);
  await page.getByLabel(t('localGoogle.name')).fill(name);
  await page.getByRole('button', { name: t('localGoogle.continue') }).click();
  await expect(page).toHaveURL(appPath(locale));
}
