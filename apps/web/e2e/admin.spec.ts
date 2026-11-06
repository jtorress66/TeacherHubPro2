import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { resetSuperAdmins } from './database.ts';
import { logIn, signUp, skipTour, uniqueEmail } from './helpers.ts';

const setupKey = 'e2e-super-admin-setup-key';
const newPassword = 'a brand new long password';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
    .violations;

/** The set-password link from the newest email to an address, in the development mailbox. */
async function emailedLink(page: Page, locale: Locale, email: string): Promise<string> {
  await page.goto(`/${locale}/dev/mail`);
  const mail = page
    .getByRole('article')
    .filter({ hasText: `To ${email}` })
    .first();
  const body = (await mail.locator('pre').textContent()) ?? '';
  const link = /https?:\/\/\S+\/set-password#\S+/u.exec(body)?.[0];
  if (link === undefined) throw new Error(`no set-password link for ${email}`);
  return link;
}

/** Opens an emailed link in a fresh browser and chooses a password. */
async function choosePassword(browser: Browser, locale: Locale, link: string): Promise<Page> {
  const t = createTranslator(locale);
  const page = await (await browser.newContext()).newPage();
  await skipTour(page);
  await page.goto(link);
  const form = page.getByRole('form', { name: t('passwords.setTitle') });
  await form.getByLabel(t('passwords.newPassword')).fill(newPassword);
  await form.getByRole('button', { name: t('passwords.save') }).click();
  await expect(page.getByRole('status')).toHaveText(t('passwords.saved'));
  return page;
}

test.beforeEach(async () => {
  await resetSuperAdmins();
});

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 17 gate: a super admin imports a school's teachers and students; a school admin
  // cannot see another school.
  test(`a super admin sets up a school by import, and its admin sees only that school (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const stamp = `${locale}${String(Date.now())}`;
    const rootEmail = await signUp(page, locale, uniqueEmail('root'));
    const rootSchoolPath = new URL(page.url()).pathname;
    expect(rootSchoolPath).toBe(`/${locale}/app`);

    // The first super admin, with the server's setup key.
    await page.goto(`/${locale}/setup`);
    const setup = page.getByRole('form', { name: t('passwords.setupTitle') });
    await setup.getByLabel(t('auth.email')).fill(rootEmail);
    await setup.getByLabel(t('passwords.setupKey')).fill(setupKey);
    await setup.getByRole('button', { name: t('passwords.setupButton') }).click();
    await expect(page.getByRole('status')).toContainText(rootEmail);

    // A new school, then its staff from a CSV file.
    await page.goto(`/${locale}/app`);
    await page.getByRole('link', { name: t('nav.superAdmin'), exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('superAdmin.title'));
    expect(await axe(page)).toEqual([]);
    await page.getByRole('link', { name: t('superAdmin.schools'), exact: true }).click();
    const newSchool = page.getByRole('form', { name: t('superAdmin.createSchool') });
    await newSchool.getByLabel(t('superAdmin.schoolName')).fill(`Lincoln ${stamp}`);
    await newSchool.getByRole('button', { name: t('superAdmin.createSchool') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Lincoln ${stamp}`);
    const schoolPath = new URL(page.url()).pathname;

    const principal = `pat.${stamp}@lincoln.edu`;
    await page.getByRole('link', { name: t('superAdmin.import'), exact: true }).click();
    const teachers = page.getByRole('form', { name: t('superAdmin.importTeachers') });
    await teachers.getByLabel(t('superAdmin.school')).selectOption({ label: `Lincoln ${stamp}` });
    await teachers.getByLabel(t('superAdmin.file')).setInputFiles({
      name: 'teachers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `Name,Email,Role\nPat Principal,${principal},school_admin\n` +
          `Tina Teacher,tina.${stamp}@lincoln.edu,teacher\nOmar Other,omar.${stamp}@lincoln.edu,\n`,
        'utf8',
      ),
    });
    await teachers.getByRole('button', { name: t('superAdmin.importButton') }).click();
    await expect(teachers.getByRole('status')).toHaveText(t('superAdmin.imported', { count: 3 }));
    expect(await axe(page)).toEqual([]);

    // The school admin chooses a password from the emailed link and sees only their school.
    const admin = await choosePassword(browser, locale, await emailedLink(page, locale, principal));
    await logIn(admin, locale, principal, newPassword);
    await admin.getByRole('link', { name: t('nav.schoolUsers'), exact: true }).click();
    const users = admin.getByRole('table', { name: t('admin.title') });
    await expect(users.getByRole('row')).toHaveCount(4);
    await expect(users).not.toContainText(rootEmail);
    await users
      .getByRole('combobox', { name: t('admin.roleFor', { name: 'Tina Teacher' }) })
      .selectOption('school_admin');
    await users
      .getByRole('form', { name: t('admin.roleFor', { name: 'Tina Teacher' }) })
      .getByRole('button', { name: t('admin.saveRole') })
      .click();
    await expect(
      users.getByRole('form', { name: t('admin.roleFor', { name: 'Tina Teacher' }) }),
    ).toContainText(t('admin.roleSaved'));
    expect(await axe(admin)).toEqual([]);
    await expect(admin.getByRole('link', { name: t('nav.superAdmin'), exact: true })).toHaveCount(
      0,
    );
    for (const path of [`/${locale}/app/super-admin`, schoolPath]) {
      const response = await admin.goto(path);
      expect(response?.status()).toBe(404);
    }

    // The school admin makes a class; the super admin imports its students.
    await admin.goto(`/${locale}/app/classes`);
    const newClass = admin.getByRole('form', { name: t('classes.newClass') });
    await newClass.getByLabel(t('classes.name')).fill(`Bio ${stamp}`);
    await newClass.getByRole('button', { name: t('classes.create') }).click();
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText(`Bio ${stamp}`);

    await page.goto(`/${locale}/app/super-admin/import`);
    const students = page.getByRole('form', { name: t('superAdmin.importStudents') });
    await students
      .getByLabel(t('superAdmin.class'))
      .selectOption({ label: `Lincoln ${stamp} · Bio ${stamp}` });
    await students.getByLabel(t('superAdmin.file')).setInputFiles({
      name: 'students.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('First name,Last name\nAna,Zayas\nBen,Acosta\n', 'utf8'),
    });
    await students.getByRole('button', { name: t('superAdmin.importButton') }).click();
    await expect(students.getByRole('status')).toHaveText(t('superAdmin.imported', { count: 2 }));

    await page.goto(schoolPath);
    await expect(page.getByRole('list', { name: t('superAdmin.schoolClasses') })).toContainText(
      `Bio ${stamp}`,
    );
  });

  test(`a teacher resets a forgotten password from the emailed link (${locale})`, async ({
    page,
    browser,
  }) => {
    const email = await signUp(page, locale, uniqueEmail('forgot'));
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/${locale}/login`);
    await visitor.getByRole('link', { name: t('passwords.forgot') }).click();
    const form = visitor.getByRole('form', { name: t('passwords.forgotTitle') });
    await form.getByLabel(t('auth.email')).fill(email);
    await form.getByRole('button', { name: t('passwords.sendReset') }).click();
    await expect(visitor.getByRole('status')).toHaveText(t('passwords.resetSent'));
    expect(await axe(visitor)).toEqual([]);

    const reset = await choosePassword(browser, locale, await emailedLink(page, locale, email));
    await logIn(reset, locale, email, newPassword);
    await expect(reset).toHaveURL(new RegExp(`/${locale}/app$`));
  });
}
