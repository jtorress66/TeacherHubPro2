import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

const plansPath = (locale: Locale) => `/${locale}/app/plans`;

/** Asks the AI (the worker's scripted stand-in in tests) for a draft and waits for the editor. */
async function draftPlan(page: Page, locale: Locale, topic: string): Promise<string> {
  const t = createTranslator(locale);
  await page.goto(plansPath(locale));
  await page.getByRole('link', { name: t('planner.draftWithAi') }).click();
  await page.getByLabel(t('drafts.topic')).fill(topic);
  await page.getByRole('button', { name: t('drafts.submit') }).click();
  await expect(page).toHaveURL(/\/plans\/draft\/[^/]+$/);
  const jobId = page.url().split('/').at(-1) ?? '';
  await expect(page).toHaveURL(/\/plans\/new\?draft=/, { timeout: 30_000 });
  return jobId;
}

async function savePlan(page: Page, locale: Locale): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('button', { name: t('planner.save') }).click();
  await expect(page).toHaveURL(/\/plans\/[^/?]+\?saved=1$/);
  await expect(page.getByRole('status').filter({ hasText: t('planner.saved') })).toBeVisible();
  return new URL(page.url()).pathname;
}

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 8 gate: generate a plan as a job → edit → print.
  test(`a teacher drafts a plan with AI, edits it and prints it (${locale})`, async ({ page }) => {
    await signUp(page, locale);
    await draftPlan(page, locale, 'Fracciones');

    await expect(page.getByRole('note')).toHaveText(t('planner.draftNotice'));
    const objective = page.getByLabel(t('planner.objective'), { exact: true });
    await expect(objective).toHaveValue('Students explain the topic in their own words.');
    await expect(
      page.getByLabel(`${t('planner.theme')} (${t('planner.day_Mon')})`, { exact: true }),
    ).toHaveValue('Introduction');
    await expect(page.getByLabel(t('planner.standards'), { exact: true })).toHaveValue(
      /^CCSS\.Math\.\S+$/,
    );

    await objective.fill('Comparar fracciones con modelos');
    const planPath = await savePlan(page, locale);
    await expect(page.getByLabel(t('planner.objective'), { exact: true })).toHaveValue(
      'Comparar fracciones con modelos',
    );

    await page.getByRole('link', { name: t('planner.print') }).click();
    await expect(page).toHaveURL(`${planPath}/print`);
    const printed = page.getByTestId('print-plan');
    await expect(printed).toContainText('Comparar fracciones con modelos');
    await expect(page.getByTestId('print-standards')).toContainText('CCSS.Math');
    await expect(printed.locator('table.md-table').first()).toBeVisible();
    await expect(printed.locator('.blank').first()).toBeVisible();
    const text = await printed.innerText();
    expect(text).not.toContain('\\_');
    expect(text).not.toContain('|---|');
    await expect(page.getByRole('button', { name: t('attendance.print') })).toBeVisible();
  });
}

test('folders file plans, and deleting a folder moves them to Unfiled', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await page.goto(plansPath('en'));
  const newFolder = page.getByRole('form', { name: t('folders.create') });
  await newFolder.getByLabel(t('folders.name')).fill('Unit 1');
  await newFolder.getByRole('button', { name: t('folders.create') }).click();
  await expect(page.getByRole('link', { name: 'Unit 1' })).toBeVisible();

  await page.goto(`${plansPath('en')}/new?kind=weekly`);
  await page.getByLabel(t('planner.planTitle')).fill('Fractions week');
  await savePlan(page, 'en');
  const move = page.getByRole('form', { name: t('planner.move') });
  await move.getByLabel(t('planner.folder')).selectOption({ label: 'Unit 1' });
  await move.getByRole('button', { name: t('planner.move') }).click();
  await expect(page.getByRole('status').filter({ hasText: t('planner.saved') })).toHaveCount(2);

  await page.goto(plansPath('en'));
  await page.getByRole('link', { name: 'Unit 1' }).click();
  await expect(page.getByTestId('plan-list')).toContainText('Fractions week');
  await page.getByRole('link', { name: t('planner.unfiled') }).click();
  await expect(page.getByText(t('planner.noPlans'))).toBeVisible();

  const folder = page.getByRole('form', { name: t('folders.renameNamed', { name: 'Unit 1' }) });
  await folder.getByRole('button', { name: t('folders.delete') }).click();
  await expect(page.getByRole('link', { name: 'Unit 1' })).toHaveCount(0);
  await page.goto(`${plansPath('en')}?folder=unfiled`);
  await expect(page.getByTestId('plan-list')).toContainText('Fractions week');
});

test('a two-week plan duplicates to the next week and shows on the calendar', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await page.goto(`${plansPath('en')}/new?kind=weekly&start=2026-09-07`);
  await page.getByLabel(t('planner.planTitle')).fill('Two weeks');
  await page.getByLabel(t('planner.addWeek2')).check();
  await expect(page.getByLabel(t('planner.weekStart'))).toHaveCount(2);
  await expect(page.getByLabel(t('planner.weekStart')).nth(1)).toHaveValue('2026-09-14');
  await savePlan(page, 'en');

  const duplicate = page.getByRole('form', { name: t('planner.duplicate') });
  await duplicate.getByLabel(t('planner.duplicateStart')).fill('2026-09-21');
  await duplicate.getByRole('button', { name: t('planner.duplicate') }).click();
  await expect(page.getByLabel(t('planner.weekStart')).first()).toHaveValue('2026-09-21');
  await expect(page.getByLabel(t('planner.weekStart')).nth(1)).toHaveValue('2026-09-28');

  await page.goto(`${plansPath('en')}?view=calendar&month=2026-09`);
  const calendar = page.getByTestId('plan-calendar');
  await expect(calendar.getByRole('link', { name: 'Two weeks' }).first()).toBeVisible();
  expect(await calendar.getByRole('link', { name: 'Two weeks' }).count()).toBeGreaterThan(10);
});

test('a teacher starts from a starter template and writes a Conversational English plan (es)', async ({
  page,
}) => {
  const t = createTranslator('es');
  await signUp(page, 'es');
  await page.goto('/es/app/templates');
  await page
    .getByRole('button', { name: `${t('templates.use')}: Introducción a las fracciones` })
    .click();
  await expect(page.getByLabel(t('planner.unit'))).toHaveValue('Introducción a las fracciones');
  await savePlan(page, 'es');

  await page.goto(`${plansPath('es')}/new?kind=conversational_english`);
  await page.getByLabel(t('planner.planTitle')).fill('En el restaurante');
  await page.getByLabel(t('planner.hook')).fill('Adivina el plato');
  await page.getByLabel(t('planner.ceNotes')).fill('Practica: I would like \\_\\_\\_, please.');
  await savePlan(page, 'es');
  await page.getByRole('link', { name: t('planner.print') }).click();
  const printed = page.getByTestId('print-plan');
  await expect(printed).toContainText('Adivina el plato');
  await expect(printed.locator('.blank')).toHaveCount(1);
  expect(await printed.innerText()).not.toContain('\\_');
});

test('a draft job is visible only to its owner', async ({ page, browser }) => {
  await signUp(page, 'en');
  const jobId = await draftPlan(page, 'en', 'Fractions');

  const other = await browser.newPage();
  await signUp(other, 'en');
  const api = await other.request.get(`/api/jobs/${jobId}`);
  expect(api.status()).toBe(404);
  const progress = await other.goto(`/en/app/plans/draft/${jobId}`);
  expect(progress?.status()).toBe(404);
  const drafted = await other.goto(`/en/app/plans/new?draft=${jobId}`);
  expect(drafted?.status()).toBe(404);
  await other.close();
});
