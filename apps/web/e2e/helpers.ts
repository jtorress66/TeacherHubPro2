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

/** Creates a class with Ana Zayas, Ben Acosta and Cara Morales; returns its page's path. */
export async function classWithStudents(page: Page, locale: Locale): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Historia 6');
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia 6');

  const importForm = page.getByRole('form', { name: t('students.importTitle') });
  await importForm.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('First name,Last name\nAna,Zayas\nBen,Acosta\nCara,Morales\n', 'utf8'),
  });
  await importForm.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 3 }));
  return new URL(page.url()).pathname;
}
