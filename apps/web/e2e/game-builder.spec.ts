import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const card = (form: Locator, number: number) =>
    form.getByRole('group', { name: t('games.builderLegend_questions', { number }) });

  async function fillQuestion(form: Locator, number: number, prompt: string, answers: string[]) {
    const question = card(form, number);
    await question.getByLabel(t('games.builderQuestion'), { exact: true }).fill(prompt);
    for (const [index, answer] of answers.entries()) {
      if (index >= 2) {
        await question.getByRole('button', { name: t('games.builderAddAnswer') }).click();
      }
      await question
        .getByLabel(t('games.builderAnswer', { option: index + 1 }), { exact: true })
        .fill(answer);
    }
  }

  async function newGameForm(page: Page, title: string) {
    await page.goto(`/${locale}/app/games`);
    const form = page.getByRole('form', { name: t('games.newGame') });
    await form.getByLabel(t('games.titleLabel')).fill(title);
    await form.getByLabel(t('games.mode')).selectOption('quiz');
    return form;
  }

  test(`a teacher builds a quiz with question cards, copies it and adds another game's questions (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);

    // A second game to borrow from later, typed fast as text.
    const rivers = await newGameForm(page, 'Rivers');
    await rivers.getByRole('button', { name: t('games.builderAsText') }).click();
    await rivers
      .getByRole('textbox', { name: t('games.content'), exact: true })
      .fill(
        'Longest river? | *Nile | Rhine\nRiver in Paris? | *Seine | Po\nRiver in Rome? | *Tiber | Thames',
      );
    await rivers.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rivers');

    // The cards: one to start, three filled, a fourth added then deleted, the last moved up.
    const form = await newGameForm(page, 'Capitals');
    await expect(form.getByText(t('games.builderCount', { count: 1, max: 30 }))).toBeVisible();
    await fillQuestion(form, 1, 'Capital of Peru?', ['Quito', 'Lima', 'Bogotá']);
    await card(form, 1)
      .getByLabel(t('games.builderCorrect', { option: 2 }))
      .check();
    for (const number of [2, 3, 4]) {
      await form.getByRole('button', { name: t('games.builderAdd_questions') }).click();
      await expect(card(form, number)).toBeVisible();
    }
    await fillQuestion(form, 2, 'Capital of Chile? | trick', ['Santiago', 'Lima']);
    await fillQuestion(form, 3, 'Capital of Spain?', ['Madrid', 'Rome']);
    await card(form, 4)
      .getByRole('button', { name: t('games.builderDelete') })
      .click();
    await expect(card(form, 4)).toHaveCount(0);
    await card(form, 3)
      .getByRole('button', { name: t('games.builderMoveUp') })
      .click();
    await expect(card(form, 2).getByLabel(t('games.builderQuestion'), { exact: true })).toHaveValue(
      'Capital of Spain?',
    );

    // "Edit as text" shows the same questions, and back to cards keeps them.
    await form.getByRole('button', { name: t('games.builderAsText') }).click();
    await expect(form.getByRole('textbox', { name: t('games.content'), exact: true })).toHaveValue(
      /^Capital of Peru\? \| Quito \| \*Lima \| Bogotá\n/u,
    );
    await form.getByRole('button', { name: t('games.builderAsCards') }).click();
    await expect(card(form, 1).getByLabel(t('games.builderCorrect', { option: 2 }))).toBeChecked();

    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Capitals');

    // Saved as built, even the question with a "|" in it.
    const editor = page.getByRole('form', { name: t('games.save') });
    await expect(
      card(editor, 2).getByLabel(t('games.builderQuestion'), { exact: true }),
    ).toHaveValue('Capital of Spain?');
    await expect(
      card(editor, 3).getByLabel(t('games.builderQuestion'), { exact: true }),
    ).toHaveValue('Capital of Chile? | trick');

    // Duplicate: a copy opens, ready to change.
    await page.getByRole('button', { name: t('games.duplicate') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('games.copyTitle', { title: 'Capitals' }),
    );
    await expect(page.getByText(t('games.duplicated'))).toBeVisible();

    // Add another game's questions to the copy.
    const add = page.getByRole('region', { name: t('games.addFromTitle') });
    await add.getByLabel(t('games.addFromGame')).selectOption({ label: 'Rivers' });
    await add.getByRole('button', { name: t('games.addFromSubmit') }).click();
    await expect(page.getByText(t('games.addedItems', { added: 3, skipped: 0 }))).toBeVisible();
    await expect(card(page.getByRole('form', { name: t('games.save') }), 6)).toBeVisible();

    // Adding the same game again adds nothing new.
    await add.getByLabel(t('games.addFromGame')).selectOption({ label: 'Rivers' });
    await add.getByRole('button', { name: t('games.addFromSubmit') }).click();
    await expect(add.getByRole('alert')).toHaveText(t('games.addFrom_nothingNew'));
  });
}
