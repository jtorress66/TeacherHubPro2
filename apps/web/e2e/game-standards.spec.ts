import { expect, test, type Locator } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const card = (form: Locator, number: number) =>
    form.getByRole('group', { name: t('games.builderLegend_questions', { number }) });
  const standardsBox = (scope: Locator) =>
    scope.getByLabel(t('games.builderStandards'), { exact: true });

  test(`a teacher tags game questions with standards and the coverage report counts the game (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    await page.goto(`/${locale}/app/games`);
    const form = page.getByRole('form', { name: t('games.newGame') });
    await form.getByLabel(t('games.titleLabel')).fill('Geography race');
    await form.getByLabel(t('games.mode')).selectOption('quiz');
    await form.getByLabel(t('games.class')).selectOption({ label: 'Historia 6' });
    const prompts = ['Where is Ponce?', 'Where is Arecibo?', 'Where is Fajardo?'];
    for (const [index, prompt] of prompts.entries()) {
      const number = index + 1;
      if (number > 1) {
        await form.getByRole('button', { name: t('games.builderAdd_questions') }).click();
      }
      const question = card(form, number);
      await question.getByLabel(t('games.builderQuestion'), { exact: true }).fill(prompt);
      await question
        .getByLabel(t('games.builderAnswer', { option: 1 }), { exact: true })
        .fill('South');
      await question
        .getByLabel(t('games.builderAnswer', { option: 2 }), { exact: true })
        .fill('North');
    }
    await standardsBox(card(form, 1)).fill('6.G.1, 6.G.2');

    // One code added to every card at once.
    const everyCard = form.getByRole('group', { name: t('games.builderAllStandards') });
    await standardsBox(everyCard).fill('PR.6.H.1');
    await everyCard.getByRole('button', { name: t('games.builderAllAdd') }).click();
    await expect(standardsBox(card(form, 1))).toHaveValue('6.G.1,6.G.2,PR.6.H.1');
    await expect(standardsBox(card(form, 3))).toHaveValue('PR.6.H.1');

    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geography race');

    const practised = page.getByRole('region', { name: t('games.practisesTitle') });
    for (const code of ['6.G.1', '6.G.2', 'PR.6.H.1']) {
      await expect(practised.getByText(code, { exact: true })).toBeVisible();
    }
    const editor = page.getByRole('form', { name: t('games.save') });
    await expect(standardsBox(card(editor, 2))).toHaveValue('PR.6.H.1');

    // The coverage report counts the game: practised, but no graded assignment tests it yet.
    await page.goto(`${classPath}/standards`);
    const row = page.getByTestId('coverage-row').filter({ hasText: 'PR.6.H.1' });
    await expect(row.getByRole('cell')).toHaveText([
      t('standards.coverageNotPlanned'),
      '0',
      '1',
      '—',
      '—',
      t('standards.coverage_practised'),
      '',
    ]);
    await expect(page.getByText(t('standards.coverageLegendPractised'))).toBeVisible();
  });
}
