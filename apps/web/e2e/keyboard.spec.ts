import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

// WCAG 2.1.1 and 2.4.7: everything works from the keyboard alone, and the focused control shows it.
test.use({ reducedMotion: 'reduce' });

/** Presses Tab until the target has focus, as a keyboard user would, and checks it is visible. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let presses = 0; presses < 300; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      const shown = await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      });
      expect(shown, 'the focused control shows a focus ring').toBe(true);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('The control could not be reached with the Tab key.');
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`a teacher and a student work with the keyboard alone (${locale})`, async ({
    page,
    browser,
  }) => {
    const t = createTranslator(locale);
    await signUp(page, locale);
    await tabTo(page, page.getByRole('button', { name: t('sample.add') }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sample-notice')).toBeVisible();
    const classPath = new URL(page.url()).pathname;

    // Attendance: Tab to the first student's choices, arrow to Absent, then submit.
    await page.goto(`${classPath}/attendance`);
    const first = page
      .getByRole('group')
      .filter({ has: page.getByRole('radio') })
      .first();
    await tabTo(page, first.getByLabel(t('attendance.status_present')));
    await page.keyboard.press('ArrowRight');
    await expect(first.getByLabel(t('attendance.status_absent'))).toBeChecked();
    await tabTo(page, page.getByRole('button', { name: t('attendance.submit'), exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));

    // Grading: confirm the AI's draft for the student who handed in.
    await page.goto(`/${locale}/app`);
    await tabTo(
      page,
      page
        .getByRole('region', { name: t('commandCenter.toGrade') })
        .getByRole('link', { name: t('sample.onlineQuiz') }),
    );
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('link', { name: t('questions.submissions') }));
    await page.keyboard.press('Enter');
    const answer = page.getByTestId('submission-R.');
    await tabTo(page, answer.getByRole('button', { name: t('grading.confirm') }));
    await page.keyboard.press('Enter');
    await expect(answer).toContainText(t('grading.confirmed', { score: 9, max: 10 }));

    // A student opens their link, answers and hands in.
    await page.goto(`${classPath}/student-links`);
    await tabTo(page, page.getByRole('button', { name: t('studentLinks.issue') }));
    await page.keyboard.press('Enter');
    const issued = page.getByRole('region', { name: t('studentLinks.issuedTitle') });
    const link = issued
      .getByRole('row')
      .filter({ hasText: t('sample.student2') })
      .getByTestId('student-link');
    const url = (await link.getAttribute('href')) ?? '';
    const student = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    await student.goto(url);
    await tabTo(student, student.getByRole('link', { name: t('sample.onlineQuiz') }));
    await student.keyboard.press('Enter');
    const firstQuestion = student.getByRole('radiogroup').first();
    await tabTo(student, firstQuestion.getByRole('radio').first());
    await student.keyboard.press('Space');
    await expect(firstQuestion.getByRole('radio').first()).toBeChecked();
    await tabTo(student, student.getByRole('textbox').first());
    await student.keyboard.type('One half is bigger.');
    await tabTo(student, student.getByRole('button', { name: t('student.submit') }));
    await student.keyboard.press('Enter');
    await expect(student.getByRole('status')).toContainText(
      t('student.submitted', { date: '|' }).split('|')[0] ?? '',
    );
  });
}
