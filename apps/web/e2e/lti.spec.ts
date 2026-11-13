import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { joinSchoolOf, makeSchoolAdmin } from './database.ts';
import { appPath, password, signUp, skipTour, uniqueEmail } from './helpers.ts';

const appUrl = 'http://localhost:3100';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/** A page in a browser of its own (its own cookies), with the welcome tour already seen. */
async function freshPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await skipTour(page);
  return page;
}

/**
 * A school admin opens School systems, sees the values for IT, and registers the pretend course
 * system with the values it shows. Returns the course system's client ID.
 */
async function registerTestLms(page: Page, browser: Browser, locale: Locale): Promise<string> {
  const t = createTranslator(locale);
  const lms = await freshPage(browser);
  await lms.goto(`/${locale}/test-lms`);
  const shown = async (label: string) => (await lms.getByTestId(label).textContent()) ?? '';
  const clientId = await shown('Client ID');
  expect(clientId).toMatch(/^test-client-/u);

  await page.goto(`/${locale}/app/admin`);
  await page.getByRole('link', { name: t('lti.adminLink') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('lti.title'));
  const value = (label: string) => page.getByRole('textbox', { name: label, exact: true });
  await expect(value(t('lti.loginUrl'))).toHaveValue(`${appUrl}/api/lti/login`);
  await expect(value(t('lti.launchUrl'))).toHaveValue(`${appUrl}/api/lti/launch`);
  await expect(value(t('lti.jwksUrl'))).toHaveValue(`${appUrl}/api/lti/jwks`);
  await expect(value(t('lti.domain'))).toHaveValue('localhost:3100');
  await expect(page.getByText(t('lti.none'))).toBeVisible();
  expect(await axe(page)).toEqual([]);

  const form = page.getByRole('form', { name: t('lti.addTitle') });
  const fill = async (label: string, text: string) => {
    await form.getByLabel(label, { exact: true }).fill(text);
  };
  await fill(t('lti.name'), `Test LMS ${clientId}`);
  await fill(t('lti.issuer'), await shown('Issuer'));
  await fill(t('lti.clientId'), clientId);
  await fill(t('lti.deploymentIds'), await shown('Deployment ID'));
  await fill(t('lti.authLoginUrl'), await shown('Authorization URL'));
  await fill(t('lti.authTokenUrl'), await shown('Token URL'));
  await fill(t('lti.platformJwksUrl'), await shown('Keyset URL'));
  await form.getByRole('button', { name: t('lti.add') }).click();
  await expect(page.getByRole('status')).toHaveText(t('lti.added'));
  await expect(page.getByText(`Test LMS ${clientId}`, { exact: true })).toBeVisible();
  await lms.context().close();
  return clientId;
}

/** Clicks a launch button on the pretend course system's page for this client. */
async function launch(page: Page, locale: Locale, query: string, button: string): Promise<void> {
  await page.goto(`/${locale}/test-lms?${query}`);
  await page.getByRole('button', { name: button }).click();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a school admin registers the course system and its teachers open TeacherHubPro from it (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    const adminEmail = await signUp(page, locale, uniqueEmail('admin'));
    await makeSchoolAdmin(adminEmail);
    const clientId = await registerTestLms(page, browser, locale);

    // A teacher of the same school, with an account of their own.
    const teacher = await freshPage(browser);
    const teacherEmail = await signUp(teacher, locale, uniqueEmail('teacher'));
    await joinSchoolOf(teacherEmail, adminEmail);
    await teacher.context().clearCookies();
    await skipTour(teacher);

    // The first launch asks them to log in once, then to link.
    await launch(teacher, locale, `client=${clientId}`, 'Launch as teacher');
    await expect(teacher).toHaveURL(new RegExp(`/${locale}/lti/link$`));
    await expect(teacher.getByRole('heading', { level: 1 })).toHaveText(t('lti.linkTitle'));
    await expect(teacher.getByText(t('lti.linkLogInFirst'), { exact: false })).toBeVisible();
    await teacher.getByLabel(t('auth.email'), { exact: true }).fill(teacherEmail);
    await teacher.getByLabel(t('auth.password'), { exact: true }).fill(password);
    await teacher.getByRole('button', { name: t('auth.logIn') }).click();
    await expect(teacher).toHaveURL(new RegExp(`/${locale}/lti/link$`));
    await expect(
      teacher.getByText(t('lti.linkSignedInAs', { name: 'Ana López', email: teacherEmail })),
    ).toBeVisible();
    expect(await axe(teacher)).toEqual([]);
    await teacher.getByRole('button', { name: t('lti.linkConfirm') }).click();
    await expect(teacher).toHaveURL(appPath(locale));

    // Their school has set it up.
    await teacher.goto(`/${locale}/app/integrations?group=schoolSystems`);
    await expect(teacher.getByRole('region', { name: 'Canvas', exact: true })).toContainText(
      t('connectedTools.ltiSetUp'),
    );
    await expect(
      teacher.getByRole('region', { name: t('connectedTools.tool.clever.name'), exact: true }),
    ).toContainText(t('connectedTools.comingSoon'));

    // The next launch signs them straight in.
    await teacher.context().clearCookies();
    await skipTour(teacher);
    await launch(teacher, locale, `client=${clientId}`, 'Launch as teacher');
    await expect(teacher).toHaveURL(appPath(locale));

    // Students are not served yet.
    const student = await freshPage(browser);
    await launch(student, locale, `client=${clientId}`, 'Launch as student');
    await expect(student).toHaveURL(new RegExp(`/${locale}/lti/student$`));
    await expect(student.getByRole('heading', { level: 1 })).toHaveText(t('lti.studentTitle'));
    expect(await axe(student)).toEqual([]);
  });

  test(`a teacher of another school cannot link to this school’s course system (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const adminEmail = await signUp(page, locale, uniqueEmail('admin'));
    await makeSchoolAdmin(adminEmail);
    const clientId = await registerTestLms(page, browser, locale);

    // Someone with an account in their own school launches from this school's course system.
    const outsider = await freshPage(browser);
    const outsiderEmail = await signUp(outsider, locale, uniqueEmail('outsider'));
    await launch(outsider, locale, `client=${clientId}&teacher=outsider-1`, 'Launch as teacher');
    await expect(outsider).toHaveURL(new RegExp(`/${locale}/lti/link$`));
    await expect(
      outsider.getByText(t('lti.linkSignedInAs', { name: 'Ana López', email: outsiderEmail })),
    ).toBeVisible();
    await outsider.getByRole('button', { name: t('lti.linkConfirm') }).click();
    await expect(outsider.getByText(t('lti.problem_wrong_school'))).toBeVisible();

    // Nothing was linked: the next launch still asks.
    await launch(outsider, locale, `client=${clientId}&teacher=outsider-1`, 'Launch as teacher');
    await expect(outsider).toHaveURL(new RegExp(`/${locale}/lti/link$`));

    // A course system nobody registered is turned away politely.
    await launch(outsider, locale, 'client=unregistered-client', 'Launch as teacher');
    await expect(outsider).toHaveURL(/\/en\/lti\/problem\?reason=not_set_up$/u);
    await expect(
      outsider.getByText(createTranslator('en')('lti.problem_not_set_up')),
    ).toBeVisible();
  });
}
