import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 14 gate: the teacher emails a portal link → the parent sees only confirmed
  // grades and attendance.
  test(`a teacher emails a family portal link; the parent sees confirmed grades and attendance (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    // One graded test for Ana; homework she has no grade for yet.
    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    const newAssignment = page.getByRole('form', { name: t('gradebook.newAssignment') });
    for (const [title, category, points] of [
      ['Examen 1', t('gradebook.standard_test'), 50],
      ['Tarea 1', t('gradebook.standard_homework'), 10],
    ] as const) {
      await newAssignment.getByLabel(t('gradebook.assignmentTitle')).fill(title);
      await newAssignment
        .getByLabel(t('gradebook.category'), { exact: true })
        .selectOption({ label: category });
      await newAssignment.getByLabel(t('gradebook.points')).fill(String(points));
      await newAssignment.getByRole('button', { name: t('gradebook.createAssignment') }).click();
      await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    }
    await page.getByRole('link', { name: 'Examen 1', exact: true }).click();
    await page.getByLabel(t('gradebook.scoreFor', { name: 'Zayas, Ana' })).fill('45');
    await page.getByRole('button', { name: t('gradebook.saveGrades') }).click();
    await expect(page.getByRole('status')).toHaveText(t('gradebook.gradesSaved'));

    // Two days of attendance: present, then tardy.
    for (const [date, status] of [
      ['2026-09-14', 'present'],
      ['2026-09-15', 'tardy'],
    ] as const) {
      await page.goto(`${classPath}/attendance?date=${date}`);
      await page
        .getByRole('group', { name: t('attendance.statusFor', { name: 'Ana Zayas' }) })
        .getByLabel(t(`attendance.status_${status}`))
        .check();
      await page.getByRole('button', { name: t('attendance.submit'), exact: true }).click();
      await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));
    }

    // The teacher emails Ana's family their link.
    await page.goto(`${classPath}/portal-links`);
    const email = page.getByRole('form', { name: `${t('portalLinks.email')}: Ana Zayas` });
    await email.getByLabel(t('portalLinks.emailTo')).fill('parent@example.com');
    await email.getByRole('button', { name: t('portalLinks.send') }).click();
    await expect(email.getByRole('status')).toHaveText(
      t('portalLinks.sent', { email: 'parent@example.com' }),
    );

    // The parent's inbox (the development mailbox) has the link on the configured site.
    await page.goto(`/${locale}/dev/mail`);
    const mail = page.getByRole('article').filter({ hasText: 'To parent@example.com' }).first();
    const body = (await mail.locator('pre').textContent()) ?? '';
    const url = /https?:\/\/\S+\/p\/\S+/u.exec(body)?.[0] ?? '';
    expect(url).toContain(`/${locale}/p/`);

    const parent = await (await browser.newContext()).newPage();
    await parent.goto(url);
    await expect(parent.getByRole('heading', { level: 1 })).toHaveText(
      t('family.title', { name: 'Ana Zayas' }),
    );
    const grades = parent.getByRole('table', { name: t('family.grades') });
    await expect(grades.getByRole('row').filter({ hasText: 'Examen 1' })).toContainText(
      t('family.points', { score: 45, points: 50 }),
    );
    await expect(grades.getByRole('row').filter({ hasText: 'Tarea 1' })).toContainText(
      t('family.status_not_graded'),
    );
    await expect(parent.getByText(t('family.attendanceRate', { rate: 100 }))).toBeVisible();
    expect(
      await new AxeBuilder({ page: parent }).withTags(['wcag2a', 'wcag2aa']).analyze(),
    ).toMatchObject({ violations: [] });

    // Revoked, the link shows nothing.
    await page.goto(`${classPath}/portal-links`);
    await page.getByRole('button', { name: `${t('portalLinks.revoke')}: Ana Zayas` }).click();
    await expect(
      page.getByRole('button', { name: `${t('portalLinks.revoke')}: Ana Zayas` }),
    ).toHaveCount(0);
    await parent.reload();
    await expect(parent.getByText(t('family.notFound'))).toBeVisible();
    await parent.context().close();
  });
}
