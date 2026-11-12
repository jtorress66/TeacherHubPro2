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

/** The newest link of a kind (such as `confirm-email`) emailed to an address, from the development mailbox. */
export async function emailedLink(
  page: Page,
  locale: Locale,
  email: string,
  path: 'confirm-email' | 'set-password',
): Promise<string> {
  await page.goto(`/${locale}/dev/mail`);
  const mails = page.getByRole('article').filter({ hasText: `To ${email} ` });
  for (const mail of await mails.all()) {
    const body = (await mail.locator('pre').textContent()) ?? '';
    const link = new RegExp(`https?://\\S+/${path}#\\S+`, 'u').exec(body)?.[0];
    if (link !== undefined) return link;
  }
  throw new Error(`no ${path} link for ${email}`);
}

/** Opens the emailed confirmation link and confirms, as the person would. */
export async function confirmEmail(page: Page, locale: Locale, email: string): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(await emailedLink(page, locale, email, 'confirm-email'));
  await page
    .getByRole('form', { name: t('confirmEmail.title') })
    .getByRole('button', { name: t('emails.confirmButton') })
    .click();
  await expect(page.getByRole('status')).toHaveText(t('confirmEmail.confirmed'));
}

/**
 * Signs up with the adult box ticked and, unless told not to, confirms the email from the
 * development mailbox, ending on the app's home page.
 */
export async function signUp(
  page: Page,
  locale: Locale = 'en',
  email = uniqueEmail(),
  { tour = false, confirm = true }: { readonly tour?: boolean; readonly confirm?: boolean } = {},
): Promise<string> {
  const t = createTranslator(locale);
  if (!tour) await skipTour(page);
  await page.goto(`/${locale}/signup`);
  await page.getByLabel(t('auth.name'), { exact: true }).fill('Ana López');
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
  await page.getByLabel(t('auth.adultConfirm')).check();
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page).toHaveURL(appPath(locale));
  if (confirm) {
    await confirmEmail(page, locale, email);
    await page.goto(`/${locale}/app`);
    await expect(page).toHaveURL(appPath(locale));
  }
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

/** Issues the class's links and returns the one for the named student. */
export async function studentLink(
  page: Page,
  locale: Locale,
  classPath: string,
  name: string,
): Promise<string> {
  const t = createTranslator(locale);
  await page.goto(`${classPath}/student-links`);
  await page.getByRole('button', { name: t('studentLinks.issue') }).click();
  const issued = page.getByRole('region', { name: t('studentLinks.issuedTitle') });
  const link = issued.getByRole('row').filter({ hasText: name }).getByTestId('student-link');
  return (await link.getAttribute('href')) ?? '';
}

/** Sets how the signed-in teacher's school prints plans (Settings → Your school). */
export async function choosePlanFormat(
  page: Page,
  locale: Locale,
  format: 'classic' | 'simple',
): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/settings`);
  const school = page.getByRole('region', { name: t('settings.school') });
  await school
    .getByLabel(t('settings.planFormat'))
    .selectOption({ label: t(`settings.planFormat_${format}`) });
  await school.getByRole('button', { name: t('settings.save') }).click();
  await expect(school.getByRole('status')).toHaveText(t('settings.saved'));
}

/** Asks the assistant (the worker's scripted stand-in in tests) for a worksheet. */
export async function writeWorksheet(page: Page, locale: Locale, topic: string): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/assistant`);
  const form = page.getByRole('form', { name: t('assistant.title') });
  await form.getByLabel(t('assistant.type')).selectOption('worksheet');
  await form.getByLabel(t('assistant.topic')).fill(topic);
  await form.getByRole('button', { name: t('assistant.submit') }).click();
  await expect(page).toHaveURL(/\/assistant\/[^/]+$/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/jobs\//);
}
