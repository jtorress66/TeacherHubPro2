import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { tourChapters, tourSteps } from '../src/server/demo-tour.ts';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test(`a visitor takes the product tour from the home page, step by step (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await page.getByRole('link', { name: t('marketing.home.fullTour') }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/demo$`, 'u'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('demo.title'));

    // Every chapter is listed and reachable from the contents.
    const contents = page.getByRole('navigation', { name: t('demo.contents') });
    await expect(contents.getByRole('link')).toHaveCount(tourChapters.length);
    await contents.getByRole('link', { name: t('demo.chapters.live.title') }).click();
    await expect(page).toHaveURL(/#live$/u);
    const live = page.getByRole('region', { name: t('demo.chapters.live.title') });
    await expect(live.getByRole('heading', { level: 3 })).toHaveCount(
      tourSteps.filter((s) => s.chapter === 'live').length,
    );

    // Each step shows its screenshot, taken in the page's language.
    const reveal = live.getByRole('img', { name: t('demo.steps.liveReveal.alt') });
    await reveal.scrollIntoViewIfNeeded();
    await expect(reveal).toHaveAttribute('src', `/tour/${locale}/liveReveal.jpg`);
    expect(await reveal.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const violations = (
      await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze()
    ).violations;
    expect(violations).toEqual([]);
  });

  test(`the site menu leads to the tour (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/pricing`);
    const nav = page.getByRole('navigation', { name: t('marketing.nav.label') });
    await nav.getByRole('link', { name: t('marketing.nav.demo') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('demo.title'));
  });
}
