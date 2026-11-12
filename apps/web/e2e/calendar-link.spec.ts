import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

/** A date `days` from today, as a date field takes it. */
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** A weekly plan with a theme on its first day. */
async function weeklyPlan(page: Page, locale: Locale, title: string, theme: string) {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/plans/new?kind=weekly`);
  await page.getByLabel(t('planner.planTitle')).fill(title);
  const monday = page.locator('details.plan-day').first();
  await monday.locator('summary').click();
  await monday
    .getByLabel(`${t('planner.theme')} (${t('planner.day_Mon')})`, { exact: true })
    .fill(theme);
  await page.getByRole('button', { name: t('planner.save') }).click();
  await expect(page).toHaveURL(/\/plans\/[^/?]+\?saved=1$/);
}

/** An assignment with a due date in a new class (Historia 6). */
async function dueAssignment(page: Page, locale: Locale, title: string, dueDate: string) {
  const t = createTranslator(locale);
  const classPath = await classWithStudents(page, locale);
  await page.goto(`${classPath}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form
    .getByLabel(t('gradebook.category'), { exact: true })
    .selectOption({ label: t('gradebook.standard_test') });
  await form.getByLabel(t('gradebook.dueDate')).fill(dueDate);
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
  await expect(
    page.getByRole('link', { name: t('gradebook.openCreated', { title }) }),
  ).toBeVisible();
}

/** Clicks the card's button and returns the link it shows once. */
async function makeLink(page: Page, locale: Locale, button: string): Promise<string> {
  const t = createTranslator(locale);
  const card = page.getByRole('region', { name: t('calendarFeed.title'), exact: true });
  await card.getByRole('button', { name: button }).click();
  const field = card.getByRole('textbox', { name: t('calendarFeed.linkLabel'), exact: true });
  await expect(field).toHaveValue(/\/api\/calendar\/[A-Za-z0-9_-]+\.ics$/);
  return field.inputValue();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const names =
    locale === 'es'
      ? { plan: 'Fracciones', theme: 'Mitades', assignment: 'Examen de volcanes' }
      : { plan: 'Fractions', theme: 'Halves', assignment: 'Volcano test' };

  test(`a teacher subscribes to their plans and due dates from a calendar link (${locale})`, async ({
    page,
    request,
  }) => {
    await signUp(page, locale);
    await weeklyPlan(page, locale, names.plan, names.theme);
    await dueAssignment(page, locale, names.assignment, daysFromNow(10));

    await page.goto(`/${locale}/app/settings`);
    const card = page.getByRole('region', { name: t('calendarFeed.title'), exact: true });
    await expect(card).toContainText(t('calendarFeed.intro'));
    const first = await makeLink(page, locale, t('calendarFeed.make'));
    await expect(card).toContainText(t('calendarFeed.google'));
    await expect(card).toContainText(t('calendarFeed.outlook'));
    await expect(card).toContainText(t('calendarFeed.apple'));
    await expect(card).toContainText(t('calendarFeed.privacy'));

    const feed = await request.get(first);
    expect(feed.status()).toBe(200);
    expect(feed.headers()['content-type']).toBe('text/calendar; charset=utf-8');
    expect(feed.headers()['x-robots-tag']).toContain('noindex');
    const text = await feed.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain(`X-WR-CALNAME:${t('calendarFeed.calendarName')}`);
    expect(text).toContain(`SUMMARY:${names.plan}: ${names.theme}`);
    expect(text).toContain(
      `SUMMARY:${t('calendarFeed.due', { title: names.assignment, className: 'Historia 6' })}`,
    );
    for (const student of ['Zayas', 'Acosta', 'Morales']) expect(text).not.toContain(student);
    expect((await request.get(first.replace(/\.ics$/, ''))).status()).toBe(200);

    // A new link replaces the old one, which stops working.
    await page.reload();
    await expect(card).toContainText(t('calendarFeed.active'));
    const second = await makeLink(page, locale, t('calendarFeed.newLink'));
    expect(second).not.toBe(first);
    expect((await request.get(first)).status()).toBe(404);
    expect((await request.get(second)).status()).toBe(200);

    // Turning it off stops it working.
    await card.getByRole('button', { name: t('calendarFeed.turnOff') }).click();
    await expect(card.getByRole('button', { name: t('calendarFeed.make') })).toBeVisible();
    expect((await request.get(second)).status()).toBe(404);
  });
}
