import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

/** Asks the assistant (the worker's scripted stand-in in tests) for a worksheet; returns its page. */
async function writeWorksheet(page: Page, locale: Locale, topic: string): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.assistant'), exact: true }).click();
  const form = page.getByRole('form', { name: t('assistant.title') });
  await form.getByLabel(t('assistant.type')).selectOption('worksheet');
  await form.getByLabel(t('assistant.topic')).fill(topic);
  await form.getByRole('button', { name: t('assistant.submit') }).click();
  await expect(page).toHaveURL(/\/assistant\/[^/]+$/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/jobs\//);
  return new URL(page.url()).pathname;
}

/** Asks for slides, keeps them, and waits for the editor; returns its page. */
async function draftSlides(page: Page, locale: Locale, topic: string): Promise<string> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('nav.presentations'), exact: true }).click();
  await page.getByRole('link', { name: t('presentations.generate') }).click();
  const form = page.getByRole('form', { name: t('presentations.generate') });
  await form.getByLabel(t('assistant.topic'), { exact: true }).fill(topic);
  await form.getByLabel(t('presentations.slideCount')).fill('4');
  await form.getByRole('button', { name: t('presentations.draftSubmit') }).click();
  await page.getByRole('button', { name: t('presentations.keep') }).click({ timeout: 30_000 });
  await expect(page.getByRole('form', { name: t('presentations.edit') })).toBeVisible();
  return new URL(page.url()).pathname;
}

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 9 gate: generate a worksheet.
  test(`a teacher writes a worksheet with the AI assistant, hears it and prints it (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const path = await writeWorksheet(page, locale, 'Fracciones');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fracciones');
    const article = page.locator('article.generated');
    await expect(article.getByRole('heading', { name: 'Local draft' })).toBeVisible();
    await expect(article.locator('table.md-table')).toBeVisible();

    await page.getByRole('button', { name: t('speech.listen') }).click();
    await expect(page.getByTestId('speech-audio')).toHaveAttribute(
      'src',
      /^\/api\/speech\/[0-9a-f]{64}$/,
      {
        timeout: 30_000,
      },
    );

    await page.getByRole('link', { name: t('nav.assistant'), exact: true }).click();
    await expect(
      page.getByRole('link', { name: `${t('assistant.type_worksheet')}: Fracciones` }),
    ).toBeVisible();

    await page.goto(`${path}/print`);
    const printed = page.getByTestId('print-generation');
    await expect(printed.locator('table.md-table')).toBeVisible();
    expect(await printed.innerText()).not.toContain('|---|');
  });

  // Build step 9 gate: generate a presentation.
  test(`a teacher makes slides with AI, edits, presents and prints them (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const path = await draftSlides(page, locale, 'Volcanes');

    const editor = page.getByRole('form', { name: t('presentations.edit') });
    await expect(editor.getByRole('listitem')).toHaveCount(5); // four slides and the add button
    await editor.getByLabel(t('presentations.slideTitle'), { exact: true }).fill('Los volcanes');
    await editor.getByLabel(t('presentations.emoji')).fill('🌋');
    await editor.getByRole('button', { name: t('presentations.save') }).click();
    await expect(
      page.getByRole('status').filter({ hasText: t('presentations.saved') }),
    ).toBeVisible();

    await page.reload();
    await expect(editor.getByLabel(t('presentations.slideTitle'), { exact: true })).toHaveValue(
      'Los volcanes',
    );

    await page.getByRole('link', { name: t('presentations.present'), exact: true }).click();
    await expect(page).toHaveURL(`${path}/present`);
    await expect(page.locator('.presenter .slide-title')).toHaveText('Los volcanes');
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByText(t('presentations.position', { number: 2, total: 4 })),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(path);

    await page.getByRole('link', { name: t('presentations.print') }).click();
    await expect(page.getByTestId('print-slides').locator('.print-slide')).toHaveCount(4);
  });
}

test('slides can be reordered, duplicated and removed before saving', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await page.getByRole('link', { name: t('nav.presentations'), exact: true }).click();
  const create = page.getByRole('form', { name: t('presentations.newBlank') });
  await create.getByLabel(t('presentations.name')).fill('Plants');
  await create.getByRole('button', { name: t('presentations.create') }).click();

  const editor = page.getByRole('form', { name: t('presentations.edit') });
  await editor.getByRole('button', { name: t('presentations.addSlide') }).click();
  await editor.getByLabel(t('presentations.slideTitle'), { exact: true }).fill('Roots');
  await editor.getByRole('button', { name: t('presentations.duplicate') }).click();
  await editor.getByRole('button', { name: t('presentations.moveUp') }).click();
  await editor.getByRole('button', { name: t('presentations.removeSlide') }).click();
  await editor.getByRole('button', { name: t('presentations.save') }).click();
  await expect(
    page.getByRole('status').filter({ hasText: t('presentations.saved') }),
  ).toBeVisible();

  await page.getByRole('link', { name: t('presentations.back') }).click();
  await expect(page.getByText(t('presentations.slides', { count: 2 }))).toBeVisible();
});

test('generations and presentations are visible only to their owner', async ({ page, browser }) => {
  await signUp(page, 'en');
  const generation = await writeWorksheet(page, 'en', 'Fractions');
  const presentation = await draftSlides(page, 'en', 'Volcanoes');

  const other = await browser.newPage();
  await signUp(other, 'en');
  for (const path of [generation, `${generation}/print`, presentation, `${presentation}/present`]) {
    expect((await other.goto(path))?.status()).toBe(404);
  }
  await other.close();
});
