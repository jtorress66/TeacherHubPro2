import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const card = (name: string) => ({ name, exact: true });

  test(`a teacher finds every tool in Connected tools, filters them and asks for one that is coming (${locale})`, async ({
    page,
  }) => {
    await signUp(page, locale);

    // Settings points to the new place.
    await page.goto(`/${locale}/app/settings`);
    const moved = page.getByRole('region', card(t('connectedTools.title')));
    await expect(moved).toContainText(t('connectedTools.moved'));
    await moved.getByRole('link', { name: t('connectedTools.movedLink') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('connectedTools.title'));
    await expect(
      page.getByRole('link', { name: t('nav.connectedTools'), exact: true }),
    ).toHaveAttribute('aria-current', 'page');

    await expect(page.getByRole('region', card(t('classroom.title')))).toContainText(
      t('classroom.notConnected'),
    );
    await expect(page.getByRole('region', card(t('calendarFeed.title')))).toBeVisible();
    await expect(page.getByRole('region', card(t('connectedTools.tool.forms.name')))).toContainText(
      t('connectedTools.needsClassroom'),
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);

    // One group at a time.
    const filter = page.getByRole('navigation', { name: t('connectedTools.filter') });
    await filter.getByRole('link', { name: t('connectedTools.group.google'), exact: true }).click();
    await expect(page).toHaveURL(/\?group=google$/);
    await expect(
      filter.getByRole('link', { name: t('connectedTools.group.google'), exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('region', card(t('classroom.title')))).toBeVisible();
    await expect(page.getByRole('region', card(t('canva.title')))).toHaveCount(0);

    await filter.getByRole('link', { name: t('connectedTools.group.schoolSystems') }).click();
    await expect(page.getByRole('region', card(t('classroom.title')))).toHaveCount(0);
    const clever = page.getByRole('region', card(t('connectedTools.tool.clever.name')));
    await expect(clever).toContainText(t('connectedTools.comingSoon'));
    // School systems that launch over LTI (on in tests) can be asked for; this school has none.
    await expect(page.getByRole('region', card('Canvas'))).toContainText(
      t('connectedTools.onRequest'),
    );
    await expect(page.getByRole('region', card('Canvas'))).not.toContainText(
      t('connectedTools.ltiAdminLink'),
    );

    // Asking for it starts a message to us.
    await clever
      .getByRole('link', { name: t('connectedTools.askAbout', { tool: 'Clever' }) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/contact\\?tool=clever$`));
    await expect(page.getByLabel(t('marketing.contactPage.message'))).toHaveValue(
      t('connectedTools.requestMessage', { tool: 'Clever' }),
    );

    // A made-up tool starts nothing.
    await page.goto(`/${locale}/contact?tool=printer`);
    await expect(page.getByLabel(t('marketing.contactPage.message'))).toHaveValue('');
  });
}
