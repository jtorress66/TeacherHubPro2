import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import type { Locale } from '@thp/i18n';
import {
  tourImage,
  tourScreens,
  type TourDevice,
  type TourStepId,
} from '../../src/server/demo-tour.ts';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

/**
 * Where full-HD frames for the narrated videos go (`TOUR_FRAMES=<folder>`), or null when only the
 * /demo page's screenshots are wanted. apps/tour-video turns the frames into videos.
 */
const framesSetting = process.env.TOUR_FRAMES?.trim() ?? '';
export const framesDir = framesSetting === '' ? null : framesSetting;

/** Laptop screens are drawn at 1.5× so a video frame is sharp at 1920 pixels wide. */
const desktopScale = 1.5;

/** A highlighted area on a frame, in the frame's own pixels. */
export interface FrameFocus {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One screen of the tour, as the video tool reads it from the frames' manifest. */
export interface FrameEntry {
  readonly id: TourStepId;
  readonly device: TourDevice;
  readonly focus: FrameFocus | null;
}

async function tidy(page: Page): Promise<void> {
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
}

/** Draws a glowing ring and a pointer around the area a video frame should draw the eye to. */
async function highlight(page: Page, box: FrameFocus): Promise<void> {
  await page.evaluate((area) => {
    const ring = document.createElement('div');
    ring.id = 'tour-highlight';
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${String(area.x - 8)}px`,
      top: `${String(area.y - 8)}px`,
      width: `${String(area.width + 16)}px`,
      height: `${String(area.height + 16)}px`,
      border: '3px solid #a3e635',
      borderRadius: '14px',
      boxShadow: '0 0 0 6px rgb(163 230 53 / 25%), 0 0 32px rgb(163 230 53 / 45%)',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pointer.setAttribute('viewBox', '0 0 24 24');
    pointer.setAttribute('width', '34');
    pointer.setAttribute('height', '34');
    pointer.innerHTML =
      '<path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.6 L12 13.8 L19 13.8 Z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>';
    // The pointer rests on the ring's lower-right corner, clear of what it points at.
    Object.assign(pointer.style, {
      position: 'absolute',
      right: '-22px',
      bottom: '-26px',
      filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / 45%))',
    });
    ring.appendChild(pointer);
    document.body.appendChild(ring);
  }, box);
}

/**
 * Saves the step's screenshot where the /demo page looks for it and, when frames are wanted, a
 * full-HD frame with the focus area highlighted. Returns the frame's manifest entry.
 */
export async function shot(
  page: Page,
  locale: Locale,
  step: TourStepId,
  device: TourDevice,
  focus?: Locator,
): Promise<FrameEntry> {
  await tidy(page);
  const path = `${publicDir}${tourImage(locale, step)}`;
  mkdirSync(dirname(path), { recursive: true });
  // Laptop screenshots stay 1280 wide on the page; phone ones keep their sharp 2× pixels.
  const scale = device === 'desktop' ? 'css' : 'device';
  await page.screenshot({
    path,
    type: 'jpeg',
    quality: 78,
    scale,
    animations: 'disabled',
    caret: 'hide',
  });
  if (framesDir === null) return { id: step, device, focus: null };

  const box = focus === undefined ? null : await focus.boundingBox();
  if (box !== null) await highlight(page, box);
  const frame = join(framesDir, 'frames', locale, `${step}.png`);
  mkdirSync(dirname(frame), { recursive: true });
  await page.screenshot({ path: frame, animations: 'disabled', caret: 'hide' });
  await page.evaluate(() => document.getElementById('tour-highlight')?.remove());
  const pixels = device === 'desktop' ? desktopScale : 2;
  return {
    id: step,
    device,
    focus:
      box === null
        ? null
        : {
            x: Math.round(box.x * pixels),
            y: Math.round(box.y * pixels),
            width: Math.round(box.width * pixels),
            height: Math.round(box.height * pixels),
          },
  };
}

/** Writes what the video tool needs to know about a language's frames. */
export function writeManifest(locale: Locale, manifest: unknown): void {
  if (framesDir === null) return;
  const path = join(framesDir, 'frames', locale, 'manifest.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
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
    deviceScaleFactor: device === 'phone' ? 2 : desktopScale,
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
