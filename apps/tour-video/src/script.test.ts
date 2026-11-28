import { describe, expect, it } from 'vitest';
import { createTranslator } from '@thp/i18n';
import type { Manifest } from './manifest.ts';
import { planVideos } from './script.ts';

const manifest: Manifest = {
  locale: 'en',
  chapters: [
    { id: 'live', hero: 'liveReveal' },
    { id: 'families', hero: 'parentPortal' },
  ],
  steps: [
    {
      id: 'liveLobby',
      chapter: 'live',
      device: 'desktop',
      focus: { x: 10, y: 20, width: 30, height: 40 },
    },
    { id: 'liveReveal', chapter: 'live', device: 'desktop', focus: null },
    { id: 'parentPortal', chapter: 'families', device: 'phone', focus: null },
  ],
};

const en = createTranslator('en');

describe('planVideos', () => {
  const videos = planVideos(manifest, 'en', 7);

  it('makes a short overview, then one video per chapter', () => {
    expect(videos.map((v) => v.id)).toEqual(['overview', 'chapter-live', 'chapter-families']);
    expect(videos[0]?.title).toBe(en('demo.video.introTitle'));
    expect(videos[1]?.title).toBe(`TeacherHubPro: ${en('demo.chapters.live.title')}`);
  });

  it('describes each video for its upload, ending with the tour’s address', () => {
    expect(videos[0]?.description).toBe(
      `${en('demo.metaDescription')}

${en('demo.video.madeUp')}
https://teacherhubpro.com/en/demo`,
    );
    expect(videos[1]?.description.startsWith(en('demo.chapters.live.intro'))).toBe(true);
  });

  it('opens the overview with its card, shows each chapter’s hero screen, and ends on the trial', () => {
    const scenes = videos[0]?.scenes ?? [];
    expect(scenes.map((s) => s.image)).toEqual([
      'cards/en/intro.png',
      'frames/en/liveReveal.png',
      'frames/en/parentPortal.png',
      'cards/en/outro.png',
    ]);
    expect(scenes[0]?.narration).toBe(en('demo.video.introLine'));
    expect(scenes[1]?.narration).toBe(
      `${en('demo.chapters.live.title')}. ${en('demo.chapters.live.intro')}`,
    );
    expect(scenes.at(-1)?.narration).toBe(en('demo.video.outroLine', { days: 7 }));
  });

  it('walks a chapter step by step, keeping each screen’s device and highlight', () => {
    const scenes = videos[1]?.scenes ?? [];
    expect(scenes.map((s) => s.kind)).toEqual(['card', 'desktop', 'desktop', 'card']);
    expect(scenes[0]?.image).toBe('cards/en/chapter-live.png');
    expect(scenes[1]).toMatchObject({
      image: 'frames/en/liveLobby.png',
      focus: { x: 10, y: 20, width: 30, height: 40 },
      narration: `${en('demo.steps.liveLobby.title')}. ${en('demo.steps.liveLobby.text')}`,
    });
    expect(videos[2]?.scenes[1]?.kind).toBe('phone');
  });

  it('joins a title and its words the way the language writes sentences', () => {
    const zh = createTranslator('zh');
    const scene = planVideos({ ...manifest, locale: 'zh' }, 'zh', 7)[1]?.scenes[1];
    expect(scene?.narration).toBe(
      `${zh('demo.steps.liveLobby.title')}。${zh('demo.steps.liveLobby.text')}`,
    );
  });

  it('keeps a title that already ends a sentence as it is', () => {
    const fr = planVideos({ ...manifest, locale: 'fr' }, 'fr', 7);
    for (const scene of fr.flatMap((v) => v.scenes)) {
      expect(scene.narration).not.toMatch(/[.!?]\. /u);
    }
  });
});
