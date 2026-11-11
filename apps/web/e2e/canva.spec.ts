import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

/** Asks the assistant (the worker's scripted stand-in in tests) for a worksheet. */
async function writeWorksheet(page: Page, locale: Locale, topic: string): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/assistant`);
  const form = page.getByRole('form', { name: t('assistant.title') });
  await form.getByLabel(t('assistant.type')).selectOption('worksheet');
  await form.getByLabel(t('assistant.topic')).fill(topic);
  await form.getByRole('button', { name: t('assistant.submit') }).click();
  await expect(page).toHaveURL(/\/assistant\/[^/]+$/, { timeout: 30_000 });
  await expect(page).not.toHaveURL(/\/jobs\//);
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher connects Canva and opens a presentation and a worksheet there (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.goto(`/${locale}/app/presentations`);
    const create = page.getByRole('form', { name: t('presentations.newBlank') });
    await create.getByLabel(t('presentations.name')).fill('Volcanoes');
    await create.getByRole('button', { name: t('presentations.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Volcanoes');
    const presentation = page.url();

    // Before connecting, Canva points the teacher to Settings.
    const card = page.getByRole('region', { name: t('canva.title') });
    await card.getByRole('button', { name: t('canva.open') }).click();
    await expect(card.getByRole('alert')).toContainText(t('canva.connectFirst'));
    await card.getByRole('link', { name: t('canva.settingsLink') }).click();

    const settings = page.getByRole('region', { name: t('canva.title') });
    await expect(settings).toContainText(t('canva.notConnected'));
    await settings.getByRole('link', { name: t('canva.connect') }).click();
    await expect(settings.getByRole('status')).toHaveText(t('canva.connectedNotice'));
    await expect(settings).toContainText(t('canva.connected'));

    await page.goto(presentation);
    await card.getByRole('button', { name: t('canva.open') }).click();
    await expect(card.getByRole('status')).toContainText(t('canva.ready'));
    await expect(card.getByRole('link', { name: t('canva.openDesign') })).toHaveAttribute(
      'href',
      /^https:\/\/canva\.local\/design\/LOCAL\d+\/edit$/,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);

    // The same presentation downloads as a PowerPoint file.
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: t('canva.downloadPptx') }).click();
    expect((await download).suggestedFilename()).toBe('Volcanoes.pptx');

    await writeWorksheet(page, locale, 'Fractions');
    const material = page.getByRole('region', { name: t('canva.title') });
    await material.getByRole('button', { name: t('canva.open') }).click();
    await expect(material.getByRole('link', { name: t('canva.openDesign') })).toHaveAttribute(
      'href',
      /^https:\/\/canva\.local\/design\/LOCAL\d+\/edit$/,
    );

    // Disconnecting forgets the access.
    await page.goto(`/${locale}/app/settings`);
    await settings.getByRole('button', { name: t('canva.disconnect') }).click();
    await expect(settings.getByRole('link', { name: t('canva.connect') })).toBeVisible();
  });
}
