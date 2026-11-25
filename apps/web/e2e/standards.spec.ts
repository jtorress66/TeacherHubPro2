import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { formatPercent } from '../src/server/gradebook-display.ts';
import { classWithStudents, signUp } from './helpers.ts';

/** Spanish formats use a no-break space before "%"; compare text with plain spaces. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher tags an assignment with the standards it tests (${locale})`, async ({ page }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    // A plan for the class covers one Common Core code and one Puerto Rico code.
    await page.goto(`/${locale}/app/plans/new?kind=weekly&start=2026-11-02`);
    await page
      .getByLabel(t('planner.class'), { exact: true })
      .selectOption({ label: 'Historia 6' });
    await page
      .getByLabel(t('planner.standards'), { exact: true })
      .fill('CCSS.Math.Content.4.NF.A.1');
    await page.getByLabel(t('planner.domain_other'), { exact: true }).first().fill('4.N.1.1');
    await page.getByRole('button', { name: t('planner.save') }).click();
    await expect(page).toHaveURL(/\/plans\/[^/?]+\?saved=1$/);

    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
    await form.getByLabel(t('gradebook.assignmentTitle')).fill('Fracciones');
    await form
      .getByLabel(t('gradebook.category'), { exact: true })
      .selectOption({ label: t('gradebook.standard_quiz') });
    await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
    await page.getByRole('link', { name: 'Fracciones', exact: true }).click();

    const section = page.getByRole('region', { name: t('standards.assignmentTitle') });
    await expect(section).toContainText(t('standards.assignmentNone'));

    // The plan's codes are suggested; one click adds one, with its official description.
    await section
      .getByRole('button', {
        name: t('standards.assignmentAddPlanned', { code: 'CCSS.Math.Content.4.NF.A.1' }),
      })
      .click();
    await expect(section.getByRole('status')).toHaveText(t('standards.assignmentSaved'));
    const tags = section.getByRole('list', { name: t('standards.assignmentTitle') });
    await expect(tags).toContainText('CCSS.Math.Content.4.NF.A.1');
    await expect(tags).toContainText(t('standards.set_common_core'));

    // Typed codes are kept as written, several at once.
    await section.getByLabel(t('standards.assignmentCode')).fill('4.N.1.1, ESCUELA.7');
    await section.getByRole('button', { name: t('standards.assignmentAdd'), exact: true }).click();
    await expect(tags.getByRole('listitem')).toHaveCount(3);
    await expect(tags).toContainText(t('standards.set_puerto_rico'));
    await expect(tags).toContainText(t('standards.source_typed'));
    await expect(
      section.getByRole('button', {
        name: t('standards.assignmentAddPlanned', { code: '4.N.1.1' }),
      }),
    ).toHaveCount(0);

    await section
      .getByRole('button', { name: t('standards.assignmentRemove', { code: 'ESCUELA.7' }) })
      .click();
    await expect(tags.getByRole('listitem')).toHaveCount(2);
    await expect(tags).not.toContainText('ESCUELA.7');

    // Grades the teacher confirms feed the coverage report: Ana 90, Ben 50 → class average 70.
    for (const [name, score] of [
      ['Zayas, Ana', 90],
      ['Acosta, Ben', 50],
    ] as const) {
      await page.getByLabel(t('gradebook.scoreFor', { name })).fill(String(score));
      await page.getByLabel(t('gradebook.statusFor', { name })).selectOption('');
    }
    await page.getByRole('button', { name: t('gradebook.saveGrades') }).click();
    await expect(page.getByText(t('gradebook.gradesSaved'))).toBeVisible();

    await page.goto(classPath);
    await page.getByRole('link', { name: t('standards.coverageOpen'), exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Historia 6');
    const table = page.getByRole('table', { name: t('standards.coverageTitle') });
    const rows = table.getByRole('row').filter({ has: page.getByRole('rowheader') });
    await expect(rows).toHaveCount(2);
    const fractionsRow = rows.filter({ hasText: 'CCSS.Math.Content.4.NF.A.1' });
    await expect(fractionsRow).toContainText(t('standards.coverage_watch'));
    expect(plain((await fractionsRow.getByRole('cell').nth(2).textContent()) ?? '')).toBe(
      plain(formatPercent(70, locale)),
    );
    await expect(fractionsRow.getByRole('cell').nth(3)).toHaveText('1');

    // The filter shows one status at a time; no student names appear anywhere.
    const filter = page.getByRole('navigation', { name: t('standards.coverageFilter') });
    await filter.getByRole('link', { name: `${t('standards.coverage_on_track')} (0)` }).click();
    await expect(page.getByText(t('standards.coverageFilterEmpty'))).toBeVisible();
    await filter.getByRole('link', { name: `${t('standards.coverage_watch')} (2)` }).click();
    await expect(rows).toHaveCount(2);
    await expect(page.locator('main')).not.toContainText('Zayas');

    // The school's owner sees each class counted by status.
    await page.goto(`/${locale}/app/school`);
    const card = page.getByRole('region', { name: t('standards.coverageSchoolTitle') });
    const classRow = card.getByRole('row', { name: /Historia 6/u });
    await expect(classRow.getByRole('cell').nth(1)).toHaveText('2');
    await classRow.getByRole('link', { name: 'Historia 6' }).click();
    await expect(page.getByRole('table', { name: t('standards.coverageTitle') })).toBeVisible();
  });
}
