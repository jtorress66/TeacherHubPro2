import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import type { Focus, Manifest } from './manifest.ts';

// What each video shows and says, scene by scene. The words are the /demo page's own, so the
// videos, the page and the captions always agree.

export type SceneKind = 'card' | 'desktop' | 'phone';

export interface Scene {
  /** Relative to the frames folder. */
  readonly image: string;
  readonly kind: SceneKind;
  readonly focus: Focus | null;
  readonly narration: string;
}

export interface VideoPlan {
  /** `overview` or `chapter-{id}`; also the file name. */
  readonly id: string;
  readonly title: string;
  /** For the video site: what it shows, that its students are made up, and the tour's link. */
  readonly description: string;
  readonly scenes: readonly Scene[];
}

/** A title and its words as one spoken line, punctuated the way the language writes it. */
const line = (locale: Locale, title: string, text: string): string => {
  if (locale === 'zh') return /[。！？]$/u.test(title) ? `${title}${text}` : `${title}。${text}`;
  return /[.!?]$/u.test(title) ? `${title} ${text}` : `${title}. ${text}`;
};

/** The overview and one video per chapter, for one language. */
export function planVideos(manifest: Manifest, locale: Locale, trialDays: number): VideoPlan[] {
  const t = createTranslator(locale);
  const card = (id: string, narration: string): Scene => ({
    image: `cards/${locale}/${id}.png`,
    kind: 'card',
    focus: null,
    narration,
  });
  const screen = (step: Manifest['steps'][number], narration: string): Scene => ({
    image: `frames/${locale}/${step.id}.png`,
    kind: step.device,
    focus: step.focus,
    narration,
  });
  const chapterLine = (id: string) =>
    line(
      locale,
      t(`demo.chapters.${id}.title` as MessageKey),
      t(`demo.chapters.${id}.intro` as MessageKey),
    );
  const outro = card('outro', t('demo.video.outroLine', { days: trialDays }));
  const describe = (text: string) =>
    `${text}

${t('demo.video.madeUp')}
https://teacherhubpro.com/${locale}/demo`;

  const overview: VideoPlan = {
    id: 'overview',
    title: t('demo.video.introTitle'),
    description: describe(t('demo.metaDescription')),
    scenes: [
      card('intro', t('demo.video.introLine')),
      ...manifest.chapters.flatMap((chapter) => {
        const hero = manifest.steps.find((s) => s.id === chapter.hero);
        return hero === undefined ? [] : [screen(hero, chapterLine(chapter.id))];
      }),
      outro,
    ],
  };

  const chapters = manifest.chapters.map((chapter): VideoPlan => ({
    id: `chapter-${chapter.id}`,
    title: `TeacherHubPro: ${t(`demo.chapters.${chapter.id}.title` as MessageKey)}`,
    description: describe(t(`demo.chapters.${chapter.id}.intro` as MessageKey)),
    scenes: [
      card(`chapter-${chapter.id}`, chapterLine(chapter.id)),
      ...manifest.steps
        .filter((step) => step.chapter === chapter.id)
        .map((step) =>
          screen(
            step,
            line(
              locale,
              t(`demo.steps.${step.id}.title` as MessageKey),
              t(`demo.steps.${step.id}.text` as MessageKey),
            ),
          ),
        ),
      outro,
    ],
  }));

  return [overview, ...chapters];
}
