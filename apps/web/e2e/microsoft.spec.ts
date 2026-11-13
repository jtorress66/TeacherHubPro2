import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp, writeWorksheet } from './helpers.ts';

const oneDriveLink = /^https:\/\/onedrive\.local\/TeacherHubPro\/[^/]+$/;

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher connects Microsoft and saves a presentation and a worksheet to OneDrive (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.goto(`/${locale}/app/presentations`);
    const create = page.getByRole('form', { name: t('presentations.newBlank') });
    await create.getByLabel(t('presentations.name')).fill('Volcanoes');
    await create.getByRole('button', { name: t('presentations.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Volcanoes');
    const presentation = page.url();

    // Before connecting, OneDrive points the teacher to Connected tools.
    const card = page.getByRole('region', { name: t('microsoft.title') });
    await card.getByRole('button', { name: t('microsoft.save') }).click();
    await expect(card.getByRole('alert')).toContainText(t('microsoft.connectFirst'));
    await card.getByRole('link', { name: t('microsoft.settingsLink') }).click();

    const settings = page.getByRole('region', { name: t('microsoft.title') });
    await expect(settings).toContainText(t('microsoft.notConnected'));
    await settings.getByRole('link', { name: t('microsoft.connect') }).click();
    await expect(settings.getByRole('status')).toHaveText(t('microsoft.connectedNotice'));
    await expect(settings).toContainText(t('microsoft.connected'));
    await expect(settings).toContainText(t('microsoft.disconnectNote'));

    await page.goto(presentation);
    await card.getByRole('button', { name: t('microsoft.save') }).click();
    await expect(card.getByRole('status')).toContainText(t('microsoft.saved'));
    const opened = card.getByRole('link', { name: t('microsoft.openFile') });
    await expect(opened).toHaveAttribute(
      'href',
      'https://onedrive.local/TeacherHubPro/Volcanoes.pptx',
    );
    await expect(opened).toHaveAttribute('target', '_blank');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);

    await writeWorksheet(page, locale, 'Fractions');
    const material = page.getByRole('region', { name: t('microsoft.title') });
    await material.getByRole('button', { name: t('microsoft.save') }).click();
    await expect(material.getByRole('link', { name: t('microsoft.openFile') })).toHaveAttribute(
      'href',
      oneDriveLink,
    );

    // Disconnecting forgets the access.
    await page.goto(`/${locale}/app/integrations`);
    await settings.getByRole('button', { name: t('microsoft.disconnect') }).click();
    await expect(settings.getByRole('link', { name: t('microsoft.connect') })).toBeVisible();
  });
}
