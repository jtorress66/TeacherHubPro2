import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithAssignment, importQuestions, studentAnswers } from './grading-helpers.ts';
import { signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const approved = (detail: string) =>
    t('approvals.detail', { action: t('activity.action_ai_grade_approved'), detail });

  test(`each approved AI grade is logged as kept or changed, and downloads as CSV (${locale})`, async ({
    page,
    browser,
  }) => {
    // Waits for two worker jobs (reading the PDF, then AI grading).
    test.setTimeout(120_000);
    await signUp(page, locale);
    const classPath = await classWithAssignment(page, locale, 'Quiz espacial');
    await importQuestions(page, locale);

    await page.goto(`${classPath}/student-links`);
    await page.getByRole('button', { name: t('studentLinks.issue') }).click();
    const issued = page.getByRole('region', { name: t('studentLinks.issuedTitle') });
    const linkOf = async (name: string) =>
      (await issued
        .getByRole('row')
        .filter({ hasText: name })
        .getByTestId('student-link')
        .getAttribute('href')) ?? '';
    const anaUrl = await linkOf('Ana Zayas');
    const benUrl = await linkOf('Ben Acosta');
    await (await studentAnswers(browser, locale, anaUrl, 'Quiz espacial')).close();
    await (await studentAnswers(browser, locale, benUrl, 'Quiz espacial', 'Ben')).close();

    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('link', { name: 'Quiz espacial', exact: true }).click();
    await page.getByRole('link', { name: t('questions.submissions') }).click();
    await page.getByRole('button', { name: t('grading.gradeWithAi') }).click();
    const ana = page.getByTestId('submission-Zayas');
    const ben = page.getByTestId('submission-Acosta');
    await expect(ana).toContainText(t('grading.status_ai_graded'), { timeout: 30_000 });
    await expect(ben).toContainText(t('grading.status_ai_graded'), { timeout: 30_000 });

    // Ana's suggestion is confirmed as it is; Ben's score is changed first.
    await ana.getByRole('button', { name: t('grading.confirm') }).click();
    await expect(ana).toContainText(t('grading.confirmed', { score: 8, max: 10 }));
    await ben.getByLabel(`${t('grading.score')} (/10)`).fill('9');
    await ben.getByRole('button', { name: t('grading.confirm') }).click();
    await expect(ben).toContainText(t('grading.confirmed', { score: 9, max: 10 }));

    await page.getByRole('link', { name: t('nav.approvals') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('approvals.title'));
    await expect(page.getByText(t('approvals.before'), { exact: false })).toBeVisible();
    const table = page.getByRole('table', { name: t('approvals.title') });
    const rows = table.getByRole('row');
    await expect(rows).toHaveCount(3);
    await expect(rows.filter({ hasText: approved(t('approvals.changed')) })).toContainText(
      'Historia 6',
    );
    await expect(rows.filter({ hasText: approved(t('approvals.kept')) })).toContainText(
      'Historia 6',
    );
    await expect(table).not.toContainText('Zayas');
    await expect(table).not.toContainText('Acosta');

    const csv = await page.request.get(
      (await page.getByRole('link', { name: t('approvals.download') }).getAttribute('href')) ?? '',
    );
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    const lines = (await csv.text()).replace(String.fromCharCode(0xfeff), '').trim().split('\r\n');
    expect(lines[0]).toBe(
      [
        t('approvals.when'),
        t('approvals.teacher'),
        t('approvals.what'),
        t('approvals.className'),
      ].join(','),
    );
    expect(lines).toHaveLength(3);
    expect(lines.join('\n')).toContain(approved(t('approvals.kept')));

    // Another type of approval: nothing yet.
    await page
      .getByRole('search', { name: t('approvals.filters') })
      .getByLabel(t('approvals.type'))
      .selectOption({ label: t('approvals.type_prep_approved') });
    await page.getByRole('button', { name: t('approvals.apply') }).click();
    await expect(page.getByText(t('approvals.empty'))).toBeVisible();
  });
}
