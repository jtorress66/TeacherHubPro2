import { expect, test, type Page } from '@playwright/test';
import { createTranslator } from '@thp/i18n';
import { signUp } from './helpers.ts';

const t = createTranslator('es');

async function createSemester(
  page: Page,
  name: string,
  start: string,
  end: string,
  active = false,
) {
  const form = page.getByRole('form', { name: t('semesters.newSemester') });
  await form.getByLabel(t('semesters.name')).fill(name);
  await form.getByLabel(t('semesters.startDate')).fill(start);
  await form.getByLabel(t('semesters.endDate')).fill(end);
  if (active) await form.getByLabel(t('semesters.makeActive')).check();
  await form.getByRole('button', { name: t('semesters.create') }).click();
  await expect(page.getByRole('listitem', { name })).toBeVisible();
}

test('semesters: one active at a time, and one used by a class cannot be deleted', async ({
  page,
}) => {
  await signUp(page, 'es');
  await page.getByRole('link', { name: t('nav.semesters'), exact: true }).click();

  await createSemester(page, 'Otoño', '2026-08-15', '2026-12-20', true);
  await createSemester(page, 'Primavera', '2027-01-10', '2027-05-30');
  await expect(
    page.getByRole('listitem', { name: 'Otoño' }).getByText(t('semesters.active'), { exact: true }),
  ).toBeVisible();

  await page
    .getByRole('listitem', { name: 'Primavera' })
    .getByRole('button', { name: t('semesters.setActive') })
    .click();
  await expect(
    page
      .getByRole('listitem', { name: 'Primavera' })
      .getByText(t('semesters.active'), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem', { name: 'Otoño' }).getByText(t('semesters.active'), { exact: true }),
  ).toHaveCount(0);

  await page.getByRole('link', { name: t('nav.classes'), exact: true }).click();
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill('Ciencias');
  await form.getByLabel(t('classes.semester')).selectOption({ label: 'Otoño' });
  await form.getByRole('button', { name: t('classes.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ciencias');

  await page.getByRole('link', { name: t('nav.semesters'), exact: true }).click();
  await page
    .getByRole('listitem', { name: 'Otoño' })
    .getByRole('button', { name: t('semesters.delete') })
    .click();
  await expect(page.getByText(t('errors.semester_in_use'))).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Otoño' })).toBeVisible();
});
