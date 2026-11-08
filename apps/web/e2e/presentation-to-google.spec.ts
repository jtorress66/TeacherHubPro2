import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

async function connectGoogle(page: Page, locale: Locale): Promise<void> {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/settings`);
  await page.getByRole('link', { name: t('classroom.connect') }).click();
  await expect(
    page.getByRole('status').filter({ hasText: t('classroom.connectedNotice') }),
  ).toBeVisible();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a teacher sends a presentation to Google Classroom as Google Slides (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);
    const presentations = `/${locale}/app/presentations`;
    await page.goto(presentations);
    const create = page.getByRole('form', { name: t('presentations.newBlank') });
    await create.getByLabel(t('presentations.name')).fill('Volcanoes');
    await create.getByRole('button', { name: t('presentations.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Volcanoes');

    const card = page.getByRole('region', { name: t('presentations.classroomTitle') });
    await expect(card.getByRole('link', { name: t('google.connect') })).toBeVisible();
    await connectGoogle(page, locale);

    await page.goto(presentations);
    await page
      .getByRole('link', { name: `${t('presentations.classroomLink')}: Volcanoes` })
      .click();
    await expect(page).toHaveURL(/#classroom$/);
    const send = card.getByRole('form', { name: t('presentations.classroomSend') });
    await expect(send.getByLabel(t('presentations.classroomName'))).toHaveValue('Volcanoes');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#classroom')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await send.getByLabel(t('classroom.course')).selectOption({ label: 'Local Classroom course' });
    await send.getByLabel(t('presentations.classroomDueDate')).fill('2026-12-01');
    await send.getByRole('button', { name: t('presentations.classroomSend') }).click();

    await expect(card.getByRole('status')).toContainText(t('presentations.classroomSent'));
    await expect(
      card.getByRole('link', { name: t('presentations.classroomOpen') }),
    ).toHaveAttribute('href', /^https:\/\/classroom\.local\//);
    await expect(
      card.getByRole('link', { name: t('presentations.classroomOpenSlides') }),
    ).toHaveAttribute('href', /^https:\/\/slides\.local\/presentation\/d\/local-deck-\d+\/edit$/);

    // Or schedule it: Classroom publishes it then, and the notice says when.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await send.getByLabel(t('classroom.course')).selectOption({ label: 'Local Classroom course' });
    await send.getByLabel(t('schedule.later')).check();
    await send.getByLabel(t('schedule.date'), { exact: true }).fill(tomorrow);
    await send.getByLabel(t('schedule.time'), { exact: true }).fill('08:30');
    await send.getByRole('button', { name: t('presentations.classroomSend') }).click();
    const scheduled = t('schedule.scheduledFor', { when: '|' }).split('|')[0] ?? '';
    await expect(card.getByRole('status')).toContainText(scheduled);
  });
}
