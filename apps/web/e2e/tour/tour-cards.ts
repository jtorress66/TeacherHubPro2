import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { trialDays } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { tourChapters } from '../../src/server/demo-tour.ts';
import { framesDir } from './tour-kit.ts';

// The title cards between a video's screens: its opening, each chapter's title and its closing.
// They are drawn on the site's own /demo page, so they use its fonts and colours.

interface Card {
  readonly id: string;
  readonly kicker: string;
  readonly title: string;
  readonly text: string;
  readonly footer: string;
}

const cardsFor = (locale: Locale): readonly Card[] => {
  const t = createTranslator(locale);
  const madeUp = t('demo.video.madeUp');
  return [
    {
      id: 'intro',
      kicker: 'TeacherHubPro',
      title: t('demo.video.introTitle'),
      text: t('home.tagline'),
      footer: madeUp,
    },
    ...tourChapters.map((chapter, index) => ({
      id: `chapter-${chapter.id}`,
      kicker: t('demo.chapterNumber', { n: index + 1 }),
      title: t(`demo.chapters.${chapter.id}.title`),
      text: t(`demo.chapters.${chapter.id}.intro`),
      footer: madeUp,
    })),
    {
      id: 'outro',
      kicker: 'TeacherHubPro',
      title: t('demo.video.outroTitle', { days: trialDays }),
      text: 'teacherhubpro.com',
      footer: t('marketing.nav.startTrial'),
    },
  ];
};

/** Draws every title card of a language as a full-HD frame, when frames are wanted. */
export async function drawCards(page: Page, locale: Locale): Promise<void> {
  if (framesDir === null) return;
  // Video frames are 16:9: 1280 × 720 at 1.5× is 1920 × 1080.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/${locale}/demo`);
  await page.waitForLoadState('networkidle');
  for (const card of cardsFor(locale)) {
    await page.evaluate((c) => {
      document.body.innerHTML = `
        <main style="position:fixed;inset:0;display:grid;place-items:center;
          background:radial-gradient(circle at 20% 15%, #1d4ed8 0%, transparent 45%),
            radial-gradient(circle at 85% 90%, #4d7c0f 0%, transparent 40%), #0e131d;
          color:#f8fafc;padding:0 8vw;">
          <div style="max-width:60rem;">
            <p style="display:flex;align-items:center;gap:.8rem;margin:0 0 1.5rem;
              font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a3e635;">
              <img src="/brand/logo-mark.png" alt="" width="44" height="44">
              <span data-kicker></span>
            </p>
            <h1 data-title style="font-family:var(--font-display);font-size:4rem;line-height:1.1;
              margin:0 0 1.2rem;color:#ffffff;"></h1>
            <p data-text style="font-size:1.7rem;line-height:1.45;margin:0;color:#cbd5e1;"></p>
          </div>
          <p data-footer style="position:fixed;bottom:2.2rem;left:8vw;margin:0;font-size:1rem;
            color:#94a3b8;"></p>
        </main>`;
      const fill = (name: string, value: string) => {
        const node = document.querySelector(`[data-${name}]`);
        if (node !== null) node.textContent = value;
      };
      fill('kicker', c.kicker);
      fill('title', c.title);
      fill('text', c.text);
      fill('footer', c.footer);
    }, card);
    await page.locator('main img').evaluate((img: HTMLImageElement) => img.decode());
    const path = join(framesDir, 'cards', locale, `${card.id}.png`);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, animations: 'disabled', caret: 'hide' });
  }
}
