import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher builds rubrics and uses one on an essay question (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);

    // Start blank, fill a cell, save, and find it again after a reload.
    await page.getByRole('link', { name: t('nav.rubrics'), exact: true }).click();
    const blank = page.getByRole('form', { name: t('rubrics.startBlank') });
    await blank.getByLabel(t('rubrics.title')).fill('Lab report');
    await blank.getByLabel(t('rubrics.criteria')).fill('2');
    await blank.getByLabel(t('rubrics.levels')).fill('3');
    await blank.getByRole('button', { name: t('rubrics.create') }).click();
    const editor = page.getByRole('form', { name: t('rubrics.editor') });
    await expect(editor).toBeVisible();
    await editor.getByLabel(t('rubrics.criterionLabel', { n: 1 }), { exact: true }).fill('Method');
    await editor
      .getByLabel(
        t('rubrics.cell', { criterion: 'Method', level: t('rubrics.levelName', { points: 3 }) }),
      )
      .fill('Every step is clear');
    await editor.getByRole('button', { name: t('rubrics.save') }).click();
    await expect(editor.getByRole('status')).toHaveText(t('rubrics.saved'));
    await page.reload();
    await expect(
      page
        .getByRole('form', { name: t('rubrics.editor') })
        .getByLabel(
          t('rubrics.cell', { criterion: 'Method', level: t('rubrics.levelName', { points: 3 }) }),
        ),
    ).toHaveValue('Every step is clear');

    // Draft one with the AI (the worker's stand-in), with ESL support, and keep it.
    await page.getByRole('link', { name: t('nav.rubrics'), exact: true }).click();
    const draft = page.getByRole('form', { name: t('rubrics.aiDraft') });
    await draft.getByLabel(t('rubrics.topic')).fill('Volcano poster');
    await draft.getByLabel(t('esl.label')).check();
    await draft.getByRole('button', { name: t('rubrics.generate') }).click();
    await page.getByRole('button', { name: t('rubrics.keep') }).click({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Local rubric');
    await expect(
      page
        .getByRole('form', { name: t('rubrics.editor') })
        .getByLabel(t('rubrics.criterionLabel', { n: 1 }), { exact: true }),
    ).toHaveValue('Local criterion 1');

    // Use the first rubric on an essay question.
    const classPath = await classWithStudents(page, locale);
    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    const assignment = page.getByRole('form', { name: t('gradebook.newAssignment') });
    await assignment.getByLabel(t('gradebook.assignmentTitle')).fill('Essay');
    await assignment
      .getByLabel(t('gradebook.category'), { exact: true })
      .selectOption({ label: t('gradebook.standard_test') });
    await assignment.getByRole('button', { name: t('gradebook.createAssignment') }).click();
    await page.getByRole('link', { name: 'Essay', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Essay');
    await page.goto(`${new URL(page.url()).pathname}/questions`);
    await page.getByLabel(t('questions.type')).selectOption('essay');
    await page.getByRole('button', { name: t('questions.add') }).click();
    const builder = page.getByRole('form', { name: t('questions.title') });
    await builder.getByLabel(t('rubrics.use')).selectOption({ label: 'Lab report' });
    await expect(builder.getByLabel(t('questions.rubric'), { exact: true })).toHaveValue(
      /^Method: .*\(3\) Every step is clear/,
    );
  });
}
