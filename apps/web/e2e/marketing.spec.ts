import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { resetSuperAdmins } from './database.ts';
import { signUp, uniqueEmail } from './helpers.ts';

// The hero drawing fades in; its own test checks the motion, so these checks run with it still.
test.use({ reducedMotion: 'reduce' });

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
    const llms = await request.get('/llms.txt');
    expect(llms.headers()['content-type']).toContain('text/plain');
    expect(await llms.text()).toContain('Google Classroom');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/es/pricing');
    expect(sitemap).toContain('/en/features/gradebook');
  });

  test('sign-in pages stay out of search results; the public site does not', async ({ page }) => {
    for (const path of ['/en/login', '/es/signup', '/es/forgot-password']) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute(
        'content',
        /noindex/u,
      );
    }
    await page.goto('/en/pricing');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
});

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`the intro video waits to be played, with captions and a script (${locale})`, async ({
    page,
    request,
  }) => {
    await page.goto(`/${locale}`);
    const section = page.getByRole('region', { name: t('marketing.video.title') });
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(t('marketing.video.title'));
    const video = section.locator('video');
    await expect(video).toHaveAttribute('poster', '/video/teacherhubpro-intro-poster.jpg');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).not.toHaveAttribute('autoplay');
    await expect(video).not.toHaveAttribute('loop');
    expect(
      await video.evaluate((element) => element instanceof HTMLVideoElement && element.paused),
    ).toBe(true);
    await expect(video.locator('source')).toHaveAttribute('src', '/video/teacherhubpro-intro.mp4');
    await expect(video.locator('track[kind="captions"]')).toHaveCount(7);
    const track = video.locator('track[default]');
    await expect(track).toHaveCount(1);
    await expect(track).toHaveAttribute('srclang', locale);
    await expect(section).toContainText(t('marketing.video.note'));

    const captions = await request.get((await track.getAttribute('src')) ?? '');
    expect(captions.headers()['content-type']).toBe('text/vtt; charset=utf-8');
    const vtt = await captions.text();
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    // The closing line, in the page's language.
    expect(vtt).toContain(t('marketing.video.p9').split('. ').at(-1));
    expect((await request.get('/api/video-captions/xx.vtt')).status()).toBe(404);

    const script = section.locator('details');
    await script.getByText(t('marketing.video.scriptTitle')).click();
    await expect(script.getByText(t('marketing.video.p2'))).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });

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
    const facts = page.locator('script[type="application/ld+json"]');
    expect(JSON.parse((await facts.textContent()) ?? '{}')).toMatchObject({
      '@type': 'SoftwareApplication',
      featureList: expect.arrayContaining([t('marketing.included.google')]),
    });

    // Navigation: features, a feature page, a use case, pricing and a legal page.
    const nav = page.getByRole('navigation', { name: t('marketing.nav.label') });
    await nav.getByRole('link', { name: t('marketing.nav.features') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('marketing.featuresPage.title'),
    );
    const included = page.getByRole('region', { name: t('marketing.included.title') });
    await expect(included.getByRole('listitem')).toHaveCount(23);
    await expect(included).toContainText(t('marketing.included.prepAgent'));
    await expect(included).toContainText(t('marketing.included.canva'));
    await expect(included).toContainText(t('marketing.included.microsoft'));
    await expect(included).toContainText(t('marketing.included.teams'));
    await page
      .getByRole('link', { name: t('marketing.features.gradebook.title'), exact: true })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('marketing.features.gradebook.title'),
    );
    await page.goto(`/${locale}/integrations`);
    const tool = (name: string) => page.getByRole('region', { name, exact: true });
    await expect(tool(t('connectedTools.tool.canva.name'))).toBeVisible();
    await expect(tool(t('connectedTools.tool.onedrive.name'))).toBeVisible();
    const teamsCard = tool(t('connectedTools.tool.teams.name'));
    await expect(teamsCard).toContainText(t('connectedTools.onRequest'));
    await expect(
      teamsCard.getByRole('link', {
        name: t('connectedTools.askAbout', { tool: t('connectedTools.tool.teams.name') }),
      }),
    ).toHaveAttribute('href', `/${locale}/contact?tool=teams`);
    await page
      .getByRole('navigation', { name: t('connectedTools.filter') })
      .getByRole('link', { name: t('connectedTools.group.schoolSystems') })
      .click();
    await expect(tool('Canvas')).toContainText(t('connectedTools.comingSoon'));
    await expect(tool(t('connectedTools.tool.canva.name'))).toHaveCount(0);
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
