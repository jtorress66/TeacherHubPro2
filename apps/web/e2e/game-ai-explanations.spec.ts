import { expect, test, type Locator } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const card = (form: Locator, number: number) =>
    form.getByRole('group', { name: t('games.builderLegend_questions', { number }) });
  const why = (form: Locator, number: number) =>
    card(form, number).getByLabel(t('games.builderExplanation'));

  test(`the AI drafts explanations for cards without one; the teacher reviews and saves (${locale})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, locale);
    await classWithStudents(page, locale);

    await page.goto(`/${locale}/app/games`);
    const form = page.getByRole('form', { name: t('games.newGame') });
    await form.getByLabel(t('games.titleLabel')).fill('Puerto Rico');
    await form.getByLabel(t('games.mode')).selectOption('quiz');
    const questions = [
      ['Where is Ponce?', 'South', 'North'],
      ['Where is Arecibo?', 'North', 'South'],
      ['Where is Fajardo?', 'East', 'West'],
    ] as const;
    for (const [index, [prompt, right, wrong]] of questions.entries()) {
      const number = index + 1;
      if (number > 1) {
        await form.getByRole('button', { name: t('games.builderAdd_questions') }).click();
      }
      const question = card(form, number);
      await question.getByLabel(t('games.builderQuestion'), { exact: true }).fill(prompt);
      await question
        .getByLabel(t('games.builderAnswer', { option: 1 }), { exact: true })
        .fill(right);
      await question
        .getByLabel(t('games.builderAnswer', { option: 2 }), { exact: true })
        .fill(wrong);
    }
    const mine = 'Ponce is on the Caribbean coast.';
    await why(form, 1).fill(mine);
    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Puerto Rico');

    const ask = page.getByRole('region', { name: t('games.explainTitle') });
    await expect(ask.getByText(t('games.explainIntro', { count: 2 }))).toBeVisible();
    await ask.getByRole('button', { name: t('games.explainButton') }).click();

    // The review page: the AI's drafts on the two empty cards, the teacher's own kept.
    await expect(page.getByText(t('games.explainReview'))).toBeVisible({ timeout: 60_000 });
    const editor = page.getByRole('form', { name: t('games.save') });
    await expect(why(editor, 1)).toHaveValue(mine);
    await expect(why(editor, 2)).toHaveValue(/North/u);
    await expect(why(editor, 3)).toHaveValue(/East/u);
    await why(editor, 3).fill('Fajardo is on the east end of the island.');
    await editor.getByRole('button', { name: t('games.save') }).click();
    await expect(page.getByText(t('games.saved'))).toBeVisible();

    // Saved: every card is explained, so the button is gone.
    await page.goto(page.url().replace(/\/explanations\/.*$/u, ''));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Puerto Rico');
    const saved = page.getByRole('form', { name: t('games.save') });
    await expect(why(saved, 3)).toHaveValue('Fajardo is on the east end of the island.');
    await expect(why(saved, 2)).toHaveValue(/North/u);
    await expect(page.getByRole('region', { name: t('games.explainTitle') })).toHaveCount(0);
  });
}
