import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { makeSuperAdmin } from './database.ts';
import {
  appPath,
  confirmEmail,
  logIn,
  password,
  signUp,
  skipTour,
  uniqueEmail,
  writeWorksheet,
} from './helpers.ts';

/** Fills the sign-up form; the adult box only when asked. */
async function fillSignUp(page: Page, locale: Locale, email: string, adult: boolean) {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/signup`);
  await page.getByLabel(t('auth.name'), { exact: true }).fill('Sam Student');
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
  if (adult) await page.getByLabel(t('auth.adultConfirm')).check();
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
}

/** A fresh super admin, signed in on this page. */
async function superAdmin(page: Page, locale: Locale): Promise<string> {
  const email = await signUp(page, locale, uniqueEmail('root'));
  await makeSuperAdmin(email);
  return email;
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test.describe(`account protections (${locale})`, () => {
    test('sign-up needs the adult box and a regular email address', async ({ page }) => {
      await fillSignUp(page, locale, uniqueEmail('kid'), false);
      await expect(page.getByText(t('errors.adult_required'))).toBeVisible();

      await fillSignUp(page, locale, `kid+${randomUUID().slice(0, 8)}@mailinator.com`, true);
      await expect(page.getByText(t('errors.throwaway_email'))).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}/signup$`));
    });

    test('the AI tools wait for a confirmed email; the banner resends the link', async ({
      page,
    }) => {
      const email = await signUp(page, locale, uniqueEmail(), { confirm: false });
      const banner = page.getByRole('region', { name: t('confirmEmail.bannerTitle') });
      await expect(banner).toBeVisible();

      await page.goto(`/${locale}/app/assistant`);
      const form = page.getByRole('form', { name: t('assistant.title') });
      await form.getByLabel(t('assistant.type')).selectOption('worksheet');
      await form.getByLabel(t('assistant.topic')).fill('Fractions');
      await form.getByRole('button', { name: t('assistant.submit') }).click();
      await expect(page.getByText(t('errors.email_unconfirmed'))).toBeVisible();

      await banner.getByRole('button', { name: t('confirmEmail.resend') }).click();
      await expect(banner.getByRole('status')).toHaveText(t('confirmEmail.resent', { email }));

      await confirmEmail(page, locale, email);
      await page.goto(`/${locale}/app`);
      await expect(page.getByRole('region', { name: t('confirmEmail.bannerTitle') })).toHaveCount(
        0,
      );
      await writeWorksheet(page, locale, 'Fractions');
    });

    test('a super admin suspends an account: it is signed out and cannot sign in until reinstated', async ({
      page,
      browser,
    }) => {
      test.setTimeout(120_000);
      const teacherPage = await (await browser.newContext()).newPage();
      const teacher = await signUp(teacherPage, locale, uniqueEmail('suspend'));
      await superAdmin(page, locale);

      await page.goto(`/${locale}/app/super-admin/users?q=${encodeURIComponent(teacher)}`);
      const row = page.getByRole('listitem').filter({ hasText: teacher });
      await expect(row).toContainText(t('superAdmin.aiDrafts', { count: 0 }));
      const account = row.getByRole('form', {
        name: t('superAdmin.accountActions', { name: 'Ana López' }),
      });
      await account.getByRole('button', { name: t('superAdmin.suspend') }).click();
      await expect(account.getByRole('status')).toHaveText(
        t('superAdmin.userSuspended', { email: teacher }),
      );

      // Their open session has ended, and logging in again is refused politely.
      await teacherPage.goto(`/${locale}/app`);
      await expect(teacherPage).toHaveURL(new RegExp(`/${locale}/login`));
      await logIn(teacherPage, locale, teacher);
      await expect(teacherPage.getByText(t('errors.account_suspended'))).toBeVisible();
      await expect(teacherPage.getByRole('link', { name: t('auth.contactUs') })).toHaveAttribute(
        'href',
        `/${locale}/contact`,
      );

      await account.getByRole('button', { name: t('superAdmin.reinstate') }).click();
      await expect(account.getByRole('status')).toHaveText(
        t('superAdmin.userReinstated', { email: teacher }),
      );
      await logIn(teacherPage, locale, teacher);
      await expect(teacherPage).toHaveURL(appPath(locale));
    });

    test('a blocked domain suspends its accounts and refuses new sign-ups', async ({
      page,
      browser,
    }) => {
      test.setTimeout(120_000);
      const domain = `kids${randomUUID().slice(0, 8)}.example.org`;
      const studentPage = await (await browser.newContext()).newPage();
      const student = await signUp(studentPage, locale, `pupil@${domain}`);
      await superAdmin(page, locale);

      await page.goto(`/${locale}/app/super-admin`);
      await page.getByRole('link', { name: t('superAdmin.blockedDomains'), exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        t('superAdmin.blockedDomains'),
      );
      const form = page.getByRole('form', { name: t('superAdmin.blockDomain') });
      await form.getByLabel(t('superAdmin.domain')).fill(`@${domain.toUpperCase()}`);
      await form.getByRole('button', { name: t('superAdmin.blockDomain') }).click();
      const suspended = page.getByRole('region', { name: t('superAdmin.suspendedAccounts') });
      await expect(suspended.getByRole('status')).toHaveText(
        t('superAdmin.domainBlocked', { domain, count: 1 }),
      );
      await expect(suspended).toContainText(student);
      await expect(page.getByRole('list', { name: t('superAdmin.blockedDomains') })).toContainText(
        domain,
      );

      await logIn(studentPage, locale, student);
      await expect(studentPage.getByText(t('errors.account_suspended'))).toBeVisible();

      const visitor = await (await browser.newContext()).newPage();
      await skipTour(visitor);
      await fillSignUp(visitor, locale, `other@sub.${domain}`, true);
      await expect(visitor.getByText(t('errors.blocked_domain'))).toBeVisible();

      await page
        .getByRole('form', { name: `${t('superAdmin.unblock')} ${domain}` })
        .getByRole('button', { name: t('superAdmin.unblock') })
        .click();
      await expect(page.getByRole('list', { name: t('superAdmin.blockedDomains') })).toHaveCount(0);
    });
  });
}
