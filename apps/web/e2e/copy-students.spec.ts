import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher copies students from another class (${locale})`, async ({ page }) => {
    await signUp(page, locale);
    await classWithStudents(page, locale);

    await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
    const newClass = page.getByRole('form', { name: t('classes.newClass') });
    await newClass.getByLabel(t('classes.name')).fill('Historia 7');
    await newClass.getByRole('button', { name: t('classes.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Historia 7');

    const copy = page.getByRole('form', { name: t('students.copyTitle') });
    await copy.getByLabel(t('students.copyFrom')).selectOption({ label: 'Historia 6' });
    await copy.getByRole('button', { name: t('students.copy') }).click();
    await expect(copy.getByRole('status')).toHaveText(
      t('students.copied', { count: 3, skipped: 0 }),
    );
    await expect(page.getByText('Zayas').first()).toBeVisible();

    await copy.getByLabel(t('students.copyFrom')).selectOption({ label: 'Historia 6' });
    await copy.getByRole('button', { name: t('students.copy') }).click();
    await expect(copy.getByRole('status')).toHaveText(
      t('students.copied', { count: 0, skipped: 3 }),
    );
  });
}
