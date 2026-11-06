import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { choosePlanFormat, signUp } from './helpers.ts';

const schoolName = 'Colegio De La Inmaculada Concepción';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // The original app's two-week plan, as a Puerto Rico school prints it, with its own standards.
  test(`a two-week plan with Puerto Rico standards prints in the classic format (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, locale);
    await page.goto(`/${locale}/app/settings`);
    const school = page.getByRole('region', { name: t('settings.school') });
    await school.getByLabel(t('settings.schoolName')).fill(schoolName);
    await school.getByLabel(t('settings.address')).fill('P.O. Box 3400, Manatí, Puerto Rico 00674');
    await school.getByLabel(t('settings.phone')).fill('(787) 854-2079');
    await expect(school.getByLabel(t('settings.planFormat'))).toHaveValue('classic');
    await school.getByRole('button', { name: t('settings.save') }).click();
    await expect(school.getByRole('status')).toHaveText(t('settings.saved'));

    await page.goto(`/${locale}/app/plans/new?kind=weekly&start=2026-11-02`);
    const sm = page.getByRole('link', { name: t('planner.smButton') });
    await expect(sm).toHaveAttribute('href', 'https://loginsma.smaprendizaje.com');
    await expect(sm).toHaveAttribute('target', '_blank');

    await page.getByLabel(t('planner.unit')).fill('Chapter four Determining Point of View');
    await page.getByLabel(t('planner.story')).fill('The Doll’s House');
    await page.getByLabel(t('planner.teacherName'), { exact: true }).fill('Mrs. Fred');
    await page.getByLabel(t('planner.addWeek2')).check();
    await page
      .getByLabel(t('planner.objective'), { exact: true })
      .first()
      .fill('Students will identify the narrator’s point of view.');
    await page
      .getByLabel(t('planner.skill', { number: 1 }))
      .first()
      .fill('What is point of view');
    await page.getByLabel(t('planner.domain_reading')).first().fill('7.R.6.1, 7.R.4');
    await page.getByLabel(t('planner.domain_writing')).nth(1).fill('7.W.6');

    const monday = page.locator('details.plan-day').first();
    await monday.locator('summary').click();
    const mondayName = t('planner.day_Mon');
    await monday.getByLabel(`${t('planner.theme')} (${mondayName})`).fill('Point of View');
    await monday.getByLabel(t('planner.eca_core')).check();
    await monday.getByLabel(t('planner.dok_2')).check();
    await monday.getByLabel(t('planner.activity_vocabulary'), { exact: true }).check();
    await monday.getByLabel(t('planner.material_book'), { exact: true }).check();

    await page.getByRole('button', { name: t('planner.save') }).click();
    await expect(page).toHaveURL(/\/plans\/[^/?]+\?saved=1$/);
    await expect(page.getByLabel(t('planner.domain_reading')).first()).toHaveValue(
      '7.R.6.1, 7.R.4',
    );
    await page.getByRole('link', { name: t('planner.print') }).click();

    const week1 = page.getByRole('region', { name: t('planner.week', { number: 1 }) });
    await expect(week1).toContainText(schoolName);
    await expect(week1).toContainText('P.O. Box 3400');
    await expect(week1).toContainText(t('planPrint.tel', { phone: '(787) 854-2079' }));
    await expect(week1).toContainText(
      t('planPrint.fromTo', { start: '11/02/2026', end: '11/06/2026' }),
    );
    await expect(week1).toContainText('Students will identify the narrator’s point of view.');
    await expect(week1).toContainText('Point of View');
    await expect(week1).toContainText(t('planPrint.dok_4'));
    await expect(week1).toContainText(t('planPrint.activity_read_pages'));
    // Monday's core mark, Webb level 2, one activity and one material.
    await expect(week1.locator('[data-checked="true"]')).toHaveCount(4);

    const week2 = page.getByRole('region', { name: t('planner.week', { number: 2 }) });
    await expect(week2).toContainText(t('planPrint.week2'));

    const planning = page.getByRole('region', { name: t('planPrint.teachersPlanning') });
    await expect(planning).toContainText('Mrs. Fred');
    await expect(planning).toContainText(`${t('planner.domain_reading')} 7.R.6.1, 7.R.4`);
    await expect(planning).toContainText(`${t('planner.domain_writing')} 7.W.6`);
    await expect(planning).toContainText(t('planPrint.teacherSignature'));
    await expect(planning).toContainText(t('planPrint.principalSignature'));
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);

    const printPath = new URL(page.url()).pathname;
    await choosePlanFormat(page, locale, 'simple');
    await page.goto(printPath);
    await expect(page.getByTestId('print-plan')).toBeVisible();
    await expect(page.getByRole('region', { name: t('planPrint.teachersPlanning') })).toHaveCount(
      0,
    );
    await expect(page.getByTestId('print-standards').first()).toContainText('7.R.6.1, 7.R.4');
  });
}
