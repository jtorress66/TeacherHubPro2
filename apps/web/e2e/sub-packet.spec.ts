import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

for (const locale of ['es', 'en'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher prints a substitute packet with the roster and notes (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
    const form = page.getByRole('form', { name: t('classes.newClass') });
    await form.getByLabel(t('classes.name')).fill('Ciencias 5');
    await form.getByRole('button', { name: t('classes.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ciencias 5');
    const importForm = page.getByRole('form', { name: t('students.importTitle') });
    await importForm.getByLabel(t('students.file')).setInputFiles({
      name: 'roster.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'First name,Last name,Accommodations\nAna,Zayas,Extra time\nBen,Acosta,\n',
        'utf8',
      ),
    });
    await importForm.getByRole('button', { name: t('students.import') }).click();
    await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 2 }));

    await page.getByRole('link', { name: t('subPacket.open') }).click();
    const notes = page.getByRole('form', { name: t('subPacket.subNotes') });
    await notes.getByLabel(t('subPacket.nurseExt')).fill('Ext. 105');
    await notes.getByLabel(t('subPacket.dailyRoutines')).fill('Line up at 8:00');
    await notes.getByRole('button', { name: t('subPacket.save') }).click();
    await expect(page.getByRole('status').filter({ hasText: t('subPacket.saved') })).toBeVisible();

    await page.getByRole('button', { name: t('subPacket.print') }).click();
    const packet = page.getByTestId('print-sub-packet');
    await expect(packet).toContainText('Ext. 105');
    await expect(packet).toContainText('Line up at 8:00');
    await expect(packet).toContainText('Ana Zayas');
    await expect(packet).toContainText('Extra time');
    await expect(packet).toContainText(t('subPacket.noPlan'));
    await expect(packet.getByRole('listitem')).toHaveCount(2);

    await page.goBack();
    await notes.getByLabel(t('subPacket.includeAccommodations')).uncheck();
    await notes.getByRole('button', { name: t('subPacket.save') }).click();
    await expect(page.getByRole('status').filter({ hasText: t('subPacket.saved') })).toBeVisible();
    await page.getByRole('button', { name: t('subPacket.print') }).click();
    await expect(page.getByTestId('print-sub-packet')).not.toContainText('Extra time');
  });
}
