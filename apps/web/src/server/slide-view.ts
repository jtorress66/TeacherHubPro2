import type { Slide, SlideLayout } from '@thp/domain';

/** How a layout arranges a slide: where the picture goes and how the points are split. */
export interface SlideLook {
  readonly className: string;
  readonly picture: 'top' | 'start' | 'end';
  readonly columns: 1 | 2;
  readonly quote: boolean;
}

const looks: Readonly<Record<SlideLayout, Omit<SlideLook, 'className'>>> = {
  title: { picture: 'top', columns: 1, quote: false },
  content: { picture: 'top', columns: 1, quote: false },
  image_left: { picture: 'start', columns: 1, quote: false },
  image_right: { picture: 'end', columns: 1, quote: false },
  two_column: { picture: 'top', columns: 2, quote: false },
  quote: { picture: 'top', columns: 1, quote: true },
};

export const slideLook = (layout: SlideLayout): SlideLook => ({
  className: `slide layout-${layout}`,
  ...looks[layout],
});

/** The smallest a slide's text may shrink to, as a share of its full size. */
const minFitScale = 0.4;

/**
 * The largest text scale, between 0.4 and 1, at which a slide fits its card (`fits` lays the slide
 * out at a scale and says whether it fits). A bisection: a few layouts, whatever the content.
 */
export function fitScale(fits: (scale: number) => boolean): number {
  if (fits(1)) return 1;
  let low = minFitScale;
  let high = 1;
  for (let step = 0; step < 7; step += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/** The editor shows points one per line. */
export const bulletLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

export const bulletsText = (bullets: readonly string[]): string => bullets.join('\n');

/** What Listen reads for a slide: its words in order, without the emoji. */
export const slideSpeech = (slide: Slide): string =>
  [slide.title, slide.subtitle, slide.content, slide.bullets.join('\n')]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n\n');
