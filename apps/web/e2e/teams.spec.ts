import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

/** A Word document as the browser uploads it: a ZIP archive, which is all the app checks. */
const wordDocument = Buffer.concat([Buffer.from('PK\u0003\u0004'), Buffer.alloc(64)]);
const teamsLink = /^https:\/\/teams\.local\/class\/local-teams-class\/assignment\/[^/]+$/;

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher allows Microsoft Teams, imports a roster, shares an assignment and posts a Word document (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    // Before Teams is allowed, the class page offers no Teams import.
    await expect(page.getByRole('form', { name: t('teams.importRoster') })).toHaveCount(0);

    await page.goto(`/${locale}/app/integrations`);
    const teams = page.getByRole('region', { name: t('teams.title'), exact: true });
    await expect(teams).toContainText(t('teams.notAllowed'));
    await teams.getByRole('link', { name: t('teams.allow') }).click();
    await expect(
      page.getByRole('status').filter({ hasText: t('teams.allowedNotice') }),
    ).toBeVisible();
    await expect(teams).toContainText(t('teams.allowed'));
    await expect(teams.getByRole('link', { name: t('teams.allow') })).toHaveCount(0);
    // Allowing Teams connects Microsoft too, so OneDrive works as well.
    await expect(page.getByRole('region', { name: t('microsoft.title') })).toContainText(
      t('microsoft.connected'),
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);

    await page.goto(classPath);
    const roster = page.getByRole('form', { name: t('teams.importRoster') });
    await roster.getByLabel(t('teams.class')).selectOption({ label: 'Local Teams class' });
    await roster.getByRole('button', { name: t('teams.importRoster') }).click();
    await expect(roster.getByRole('status')).toHaveText(
      t('classroom.imported', { added: 2, skipped: 0 }),
    );
    await roster.getByRole('button', { name: t('teams.importRoster') }).click();
    await expect(roster.getByRole('status')).toHaveText(
      t('classroom.imported', { added: 0, skipped: 2 }),
    );

    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    await expect(page.getByRole('button', { name: t('gradebook.useStandard') })).toBeHidden();
    const create = page.getByRole('form', { name: t('gradebook.newAssignment') });
    await create.getByLabel(t('gradebook.assignmentTitle')).fill('Space quiz');
    await create
      .getByLabel(t('gradebook.category'), { exact: true })
      .selectOption({ label: t('gradebook.standard_test') });
    await create.getByRole('button', { name: t('gradebook.createAssignment') }).click();
    await page.getByRole('link', { name: 'Space quiz', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Space quiz');
    const assignmentPath = new URL(page.url()).pathname;

    await page.goto(`${assignmentPath}/questions`);
    const builder = page.getByRole('form', { name: t('questions.title') });
    await page.getByLabel(t('questions.type')).selectOption('true_false');
    await page.getByRole('button', { name: t('questions.add') }).click();
    await builder.getByLabel(t('questions.prompt'), { exact: true }).fill('The Sun is a star.');
    await builder.getByRole('button', { name: t('questions.save') }).click();
    await expect(builder.getByRole('status')).toHaveText(t('questions.saved'));

    const share = page.getByRole('form', { name: t('teams.share') });
    await share.getByLabel(t('teams.class')).selectOption({ label: 'Local Teams class' });
    await share.getByRole('button', { name: t('teams.share') }).click();
    await expect(share.getByRole('status')).toContainText(t('teams.shared'));
    await expect(share.getByRole('link', { name: t('teams.sharedLink') })).toHaveAttribute(
      'href',
      teamsLink,
    );

    await page.goto(`/${locale}/app/assistant`);
    const card = page.getByRole('region', { name: t('teams.wordTitle') });
    const post = card.getByRole('form', { name: t('teams.wordSubmit') });
    await post.getByLabel(t('teams.class')).selectOption({ label: 'Local Teams class' });
    await post.getByLabel(t('wordPost.name')).fill('Unit 3 test');
    await post.getByLabel(t('wordPost.dueDate')).fill('2026-12-01');
    await post.getByLabel(t('wordPost.file')).setInputFiles({
      name: 'unit-3.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: wordDocument,
    });
    await post.getByRole('button', { name: t('teams.wordSubmit') }).click();
    await expect(card.getByRole('status')).toContainText(t('teams.wordPosted'));
    await expect(card.getByRole('link', { name: t('teams.sharedLink') })).toHaveAttribute(
      'href',
      teamsLink,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('#teams-word-post-card')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}
