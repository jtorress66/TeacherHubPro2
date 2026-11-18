import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { signUp, uniqueEmail } from './helpers.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`a colleague joins through the invite link and pays: the inviter gets a free month (${locale})`, async ({
    browser,
  }) => {
    const t = createTranslator(locale);
    const inviter = await (await browser.newContext()).newPage();
    await signUp(inviter, locale, uniqueEmail('inviter'));
    await inviter.getByRole('link', { name: t('nav.invite') }).click();
    await expect(inviter.getByRole('heading', { level: 1 })).toHaveText(t('invite.title'));
    const link = await inviter.getByRole('textbox', { name: t('invite.linkLabel') }).inputValue();
    expect(link).toMatch(new RegExp(`/${locale}/signup\\?ref=[A-HJKMNP-Z2-9]{8}$`));
    await expect(inviter.getByRole('link', { name: t('invite.shareEmail') })).toHaveAttribute(
      'href',
      /^mailto:\?subject=/,
    );
    const stats = inviter.getByTestId('invite-stats');
    await expect(stats).toContainText(t('invite.joined', { count: 0 }));

    // The colleague opens the link in their own browser, signs up, and pays at once.
    const colleague = await (await browser.newContext()).newPage();
    await colleague.goto(new URL(link).pathname + new URL(link).search);
    await signUp(colleague, locale, uniqueEmail('colleague'));
    await colleague.getByRole('link', { name: t('nav.billing') }).click();
    const plan = t('plans.individual_monthly');
    await colleague
      .getByRole('form', { name: plan })
      .getByRole('button', { name: t('billing.choose', { plan }) })
      .click();
    await expect(colleague.getByText(t('checkout.testMode'))).toBeVisible();
    await colleague.getByRole('button', { name: /9[.,]99/ }).click();
    await expect(colleague.getByRole('status')).toHaveText(t('billing.checkoutSuccess'));

    await inviter.reload();
    await expect(stats).toContainText(t('invite.joined', { count: 1 }));
    await expect(stats).toContainText(t('invite.freeMonths', { count: 1 }));
    await inviter.getByRole('link', { name: t('nav.billing') }).click();
    await expect(inviter.getByText(t('billing.onTrial', { days: 37 }))).toBeVisible();
  });
}
