import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp, studentLink } from './helpers.ts';

// An ordinary phone held upright.
const phoneWidth = 390;
test.use({ viewport: { width: phoneWidth, height: 844 }, isMobile: true, hasTouch: true });

/**
 * The page never slides sideways: anything wider scrolls inside its own box. (A phone widens its
 * window to fit a page that is too wide, so the page is measured against the phone itself.)
 */
async function fitsTheScreen(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(phoneWidth);
}

/** Apple's and Google's smallest comfortable tap target. */
async function bigEnoughToTap(target: Locator): Promise<void> {
  const box = await target.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

/** The words of a message before its placeholder. */
const before = (message: (value: string) => string) => message('|').split('|')[0] ?? '';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`a teacher and a student use TeacherHubPro on a phone (${locale})`, async ({ page }) => {
    const t = createTranslator(locale);
    await signUp(page, locale);
    await page.getByRole('button', { name: t('sample.add') }).click();
    await expect(page.getByTestId('sample-notice')).toBeVisible();
    const classPath = new URL(page.url()).pathname;

    // The menu folds into one button.
    await page.getByRole('button', { name: t('nav.menu') }).click();
    await page.getByRole('link', { name: t('nav.attendance'), exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/app/attendance$`));
    await fitsTheScreen(page);

    for (const path of [
      `${classPath}/attendance/report`,
      `/${locale}/app/learning`,
      `${classPath}/gradebook`,
    ]) {
      await page.goto(path);
      await fitsTheScreen(page);
    }

    // A grade category fits on two lines: its name, then its weight with Save and Delete.
    const weight = page.getByLabel(
      startsWith(before((name) => t('gradebook.weightFor', { name }))),
    );
    const saveCategory = page.getByRole('button', { name: t('gradebook.saveCategory') });
    const [weightBox, saveBox] = await Promise.all([
      weight.first().boundingBox(),
      saveCategory.first().boundingBox(),
    ]);
    expect(Math.abs((weightBox?.y ?? 0) - (saveBox?.y ?? 100))).toBeLessThan(12);

    // Entering grades for an assignment.
    await page
      .getByRole('link', { name: t('sample.onlineQuiz') })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(t('sample.onlineQuiz'));
    await fitsTheScreen(page);

    // Taking attendance: one row of four choices per student, each easy to tap.
    await page.goto(`${classPath}/attendance`);
    await fitsTheScreen(page);
    const firstStudent = page
      .getByRole('group', {
        name: startsWith(before((name) => t('attendance.statusFor', { name }))),
      })
      .first();
    const choices = firstStudent.locator('label');
    await expect(choices).toHaveCount(4);
    const tops = await choices.evaluateAll((labels) =>
      labels.map((label) => label.getBoundingClientRect().top),
    );
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(4);
    await bigEnoughToTap(choices.first());
    await choices.filter({ hasText: t('attendance.status_absent') }).tap();
    await expect(firstStudent.getByLabel(t('attendance.status_absent'))).toBeChecked();
    await page.getByRole('button', { name: t('attendance.submit'), exact: true }).click();
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));

    // A student answers on a phone: tapping anywhere on an answer's row picks it.
    const link = await studentLink(page, locale, classPath, t('sample.student2'));
    await page.goto(link);
    await fitsTheScreen(page);
    await page.getByRole('link', { name: t('sample.onlineQuiz') }).click();
    await fitsTheScreen(page);
    const answer = page.getByRole('radiogroup').first().locator('label').nth(1);
    await bigEnoughToTap(answer);
    const box = await answer.boundingBox();
    await page.touchscreen.tap(
      (box?.x ?? 0) + (box?.width ?? 0) - 8,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await expect(answer.getByRole('radio')).toBeChecked();
  });
}
