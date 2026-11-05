import type { Presentation, PresentationTheme, Slide } from './presentation.ts';

/** A solid background and a text colour per theme, from the app's own slide themes. */
export const slideThemeColours: Readonly<
  Record<PresentationTheme, { readonly background: string; readonly text: string }>
> = {
  ocean: { background: '#1d4ed8', text: '#ffffff' },
  sunset: { background: '#ea580c', text: '#ffffff' },
  forest: { background: '#15803d', text: '#ffffff' },
  galaxy: { background: '#6d28d9', text: '#ffffff' },
  minimal: { background: '#f1f5f9', text: '#1e293b' },
  blackboard: { background: '#0f172a', text: '#f8fafc' },
  candy: { background: '#db2777', text: '#ffffff' },
  nature: { background: '#b45309', text: '#ffffff' },
};

export interface GoogleSlideLine {
  readonly text: string;
  readonly bullet: boolean;
}

/** One Google slide: a title slide or a title-and-body slide, as plain text lines. */
export interface GoogleSlide {
  readonly layout: 'title' | 'body';
  readonly title: string;
  readonly body: readonly GoogleSlideLine[];
}

export interface GoogleDeck {
  readonly name: string;
  readonly colours: (typeof slideThemeColours)[PresentationTheme];
  readonly slides: readonly GoogleSlide[];
}

const lines = (text: string | null, bullet: boolean): GoogleSlideLine[] =>
  (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => ({ text: line, bullet }));

function googleSlide(slide: Slide): GoogleSlide {
  const title = slide.title.trim();
  return {
    layout: slide.layout === 'title' ? 'title' : 'body',
    title: slide.emoji === '' || title === '' ? title : `${slide.emoji} ${title}`,
    body: [
      ...lines(slide.subtitle, false),
      ...lines(slide.content, false),
      ...slide.bullets.flatMap((bullet) => lines(bullet, true)),
    ],
  };
}

/** A presentation as Google Slides needs it: text and colours only, no layout rules. */
export const toGoogleSlides = (presentation: Presentation): GoogleDeck => ({
  name: presentation.name,
  colours: slideThemeColours[presentation.theme],
  slides: presentation.slides.map(googleSlide),
});
