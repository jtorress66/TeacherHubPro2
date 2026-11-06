import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { resetSuperAdmins } from './database.ts';
import { signUp, uniqueEmail } from './helpers.ts';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;

const questions: Readonly<Record<Locale, { price: string; bot: string; ai: string }>> = {
  en: { price: 'How much is it?', bot: 'Are you a bot?', ai: 'AI assistant' },
  es: { price: '¿Cuánto cuesta?', bot: '¿Eres un robot?', ai: 'asistente de IA' },
} as Record<Locale, { price: string; bot: string; ai: string }>;

test.describe('search engines', () => {
  test('robots.txt keeps crawlers out of the app, and the sitemap lists every language', async ({
    request,
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /*/app');
    expect(robots).toContain('Sitemap:');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/es/pricing');
    expect(sitemap).toContain('/en/features/gradebook');
  });
});

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`the public site: landing, pages, contact, chatbot and leads (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const stamp = `${locale}${String(Date.now())}`;

    // Landing: the hero, every section, real prices and search metadata.
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('home.title'));
    for (const heading of [
      'marketing.landing.featuresTitle',
      'marketing.landing.howTitle',
      'marketing.landing.whoTitle',
      'marketing.landing.trustTitle',
      'marketing.landing.pricingTitle',
      'marketing.landing.faqTitle',
      'marketing.landing.ctaTitle',
    ] as const) {
      await expect(page.getByRole('heading', { level: 2, name: t(heading) })).toBeVisible();
    }
    await expect(page.getByTestId('plan-individual_monthly')).toContainText(/9[.,]99/u);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/${locale}$`),
    );
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      t('marketing.landing.metaDescription'),
    );
    expect(await axe(page)).toEqual([]);

    // Navigation: features, a feature page, a use case, pricing and a legal page.
    const nav = page.getByRole('navigation', { name: t('marketing.nav.label') });
    await nav.getByRole('link', { name: t('marketing.nav.features') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('marketing.featuresPage.title'),
    );
    await page
      .getByRole('link', { name: t('marketing.features.gradebook.title'), exact: true })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('marketing.features.gradebook.title'),
    );
    await page.goto(`/${locale}/use-cases/schools`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('marketing.useCases.schools.title'),
    );
    await nav.getByRole('link', { name: t('marketing.nav.pricing') }).click();
    await expect(page.getByTestId('plan-individual_yearly')).toContainText('79');
    await expect(page.getByTestId('plan-school')).toContainText(
      t('marketing.pricingPage.minimum', { count: 10 }),
    );
    expect(await axe(page)).toEqual([]);
    await page.getByRole('link', { name: t('legal.privacy.title') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('legal.privacy.title'));
    expect(await axe(page)).toEqual([]);

    // The contact form becomes a lead.
    await nav.getByRole('link', { name: t('marketing.nav.contact') }).click();
    const contact = page.getByRole('form', { name: t('marketing.contactPage.title') });
    await contact.getByLabel(t('marketing.contactPage.name')).fill(`Pat ${stamp}`);
    await contact.getByLabel(t('marketing.contactPage.email')).fill(`pat.${stamp}@school.edu`);
    await contact.getByLabel(t('marketing.contactPage.role')).selectOption('principal');
    await contact.getByLabel(t('marketing.contactPage.interest')).selectOption('demo');
    await contact.getByLabel(t('marketing.contactPage.message')).fill('A demo for 30 teachers.');
    await contact.getByRole('button', { name: t('marketing.contactPage.send') }).click();
    await expect(page.getByRole('status')).toHaveText(t('marketing.contactPage.sent'));

    // The chatbot says it is an AI, quotes real prices, then takes the visitor's details.
    await page.goto(`/${locale}/pricing`);
    await page.getByRole('button', { name: t('marketing.chat.open') }).click();
    const chat = page.getByRole('region', { name: t('marketing.chat.title') });
    await expect(chat).toContainText(t('marketing.chat.intro'));
    await chat.getByRole('button', { name: t('marketing.roles.teacher') }).click();
    await chat.getByRole('button', { name: t('marketing.interests.pricing') }).click();
    const input = chat.getByLabel(t('marketing.chat.placeholder'));
    await input.fill(questions[locale].price);
    await chat.getByRole('button', { name: t('marketing.chat.send') }).click();
    await expect(chat.locator('.m-chat-ed').first()).toContainText(/9[.,]99/u, { timeout: 30_000 });
    await input.fill(questions[locale].bot);
    await chat.getByRole('button', { name: t('marketing.chat.send') }).click();
    await expect(chat.locator('.m-chat-ed').nth(1)).toContainText(questions[locale].ai, {
      timeout: 30_000,
    });
    const lead = chat.getByRole('form', { name: t('marketing.chat.leadOpen') });
    await lead.getByLabel(t('marketing.contactPage.name')).fill(`Chat ${stamp}`);
    await lead.getByLabel(t('marketing.contactPage.email')).fill(`chat.${stamp}@school.edu`);
    await lead.getByRole('button', { name: t('marketing.contactPage.send') }).click();
    await expect(chat.getByRole('status')).toHaveText(t('marketing.chat.leadSent'));
    expect(await axe(page)).toEqual([]);

    // A super admin sees both leads.
    await resetSuperAdmins();
    const admin = await (await browser.newContext()).newPage();
    const rootEmail = await signUp(admin, locale, uniqueEmail('root'));
    await admin.goto(`/${locale}/setup`);
    const setup = admin.getByRole('form', { name: t('passwords.setupTitle') });
    await setup.getByLabel(t('auth.email')).fill(rootEmail);
    await setup.getByLabel(t('passwords.setupKey')).fill('e2e-super-admin-setup-key');
    await setup.getByRole('button', { name: t('passwords.setupButton') }).click();
    await expect(admin.getByRole('status')).toContainText(rootEmail);
    await admin.goto(`/${locale}/app/super-admin/leads?q=${stamp}`);
    const leads = admin.getByRole('list', { name: t('marketing.leads.title') });
    await expect(leads.getByRole('listitem')).toHaveCount(2);
    await expect(leads).toContainText(`pat.${stamp}@school.edu`);
    await expect(leads).toContainText(`chat.${stamp}@school.edu`);
    await expect(leads).toContainText(t('marketing.leads.score_high'));
  });
}
