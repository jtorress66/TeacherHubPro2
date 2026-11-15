import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { appPath, continueHere, logIn, signUp, skipTour } from './helpers.ts';

const edgeOnWindows =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86';
const firefoxOnLinux =
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

/** A separate browser (its own cookies), as another device would be. */
async function device(browser: Browser, userAgent: string): Promise<Page> {
  const page = await (await browser.newContext({ userAgent })).newPage();
  await skipTour(page);
  return page;
}

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const laptop = t('devices.label', {
    browser: t('devices.browser_edge'),
    os: t('devices.os_windows'),
  });

  test(`one sign-in per account: a second device is warned, and continuing signs the first out (${locale})`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const first = await device(browser, edgeOnWindows);
    const email = await signUp(first, locale);

    // The second device is told which device is in use, and can still back out.
    const second = await device(browser, firefoxOnLinux);
    await logIn(second, locale, email);
    await expect(second).toHaveURL(new RegExp(`/${locale}/login/confirm`));
    await expect(second.getByRole('heading', { level: 1 })).toHaveText(t('signInConfirm.title'));
    await expect(second.getByRole('main')).toContainText(`(${laptop},`);
    await expect(second.getByRole('button', { name: t('signInConfirm.continue') })).toBeVisible();
    await expect(second.getByRole('button', { name: t('signInConfirm.cancel') })).toBeVisible();
    expect(await axe(second)).toEqual([]);

    await second.getByRole('button', { name: t('signInConfirm.cancel') }).click();
    await expect(second).toHaveURL(new RegExp(`/${locale}/login$`));
    await first.goto(`/${locale}/app`);
    await expect(first).toHaveURL(appPath(locale));

    // Continuing signs this device in and the first one out.
    await logIn(second, locale, email);
    await continueHere(second, locale);
    await expect(second).toHaveURL(appPath(locale));

    await first.goto(`/${locale}/app`);
    await expect(first).toHaveURL(new RegExp(`/${locale}/login\\?replaced=1$`));
    await expect(first.getByText(t('auth.signedOutElsewhere'))).toBeVisible();

    // The second device stays signed in.
    await second.goto(`/${locale}/app`);
    await expect(second).toHaveURL(appPath(locale));
  });

  test(`signing in again in the same browser does not warn about itself (${locale})`, async ({
    page,
  }) => {
    const email = await signUp(page, locale);
    await page.context().newPage(); // another tab shares the same cookie

    await logIn(page, locale, email);

    await expect(page).toHaveURL(appPath(locale));
  });
}
