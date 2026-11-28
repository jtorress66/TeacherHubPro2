import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { Locale } from '@thp/i18n';
import {
  tourImage,
  tourScreens,
  type TourDevice,
  type TourStepId,
} from '../../src/server/demo-tour.ts';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

/** Waits for the page to settle, then saves its screenshot where the /demo page looks for it. */
export async function shot(page: Page, locale: Locale, step: TourStepId): Promise<void> {
  await page.waitForLoadState('networkidle');
  // No blinking caret, hover or focus ring in the picture.
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // Addresses on screen read as the live site's, not the local test server's.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.textContent?.includes('localhost:3100') === true) {
        node.textContent = node.textContent
          .replaceAll('http://localhost:3100', 'https://teacherhubpro.com')
          .replaceAll('localhost:3100', 'teacherhubpro.com');
      }
    }
  });
  const path = `${publicDir}${tourImage(locale, step)}`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, type: 'jpeg', quality: 78, animations: 'disabled', caret: 'hide' });
}

/** Scrolls an element to the top of the screen, so the screenshot shows it and what follows. */
export async function scrollTo(page: Page, selector: Parameters<Page['locator']>[0]) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      el.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -16);
    });
}

/** A new browser window the size of a laptop or a phone, in the tour's language. */
export async function windowFor(
  browser: Browser,
  locale: Locale,
  device: TourDevice,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: tourScreens[device],
    deviceScaleFactor: device === 'phone' ? 2 : 1,
    isMobile: device === 'phone',
    hasTouch: device === 'phone',
    locale,
    colorScheme: 'light',
  });
  // The app's own welcome dialog would cover the screens the tour shows.
  await context.addInitScript(() => {
    document.cookie = 'thp_tour_seen=1; path=/; samesite=lax';
  });
  return context;
}
