import { describe, expect, it } from 'vitest';
import { blankSlide, slideLayouts } from '@thp/domain';
import { bulletLines, bulletsText, slideLook, slideSpeech } from './slide-view.ts';

describe('slideLook', () => {
  it('describes every layout', () => {
    for (const layout of slideLayouts) expect(slideLook(layout).className).toContain(layout);
  });

  it('places the picture and splits the points by layout', () => {
    expect(slideLook('image_left')).toMatchObject({ picture: 'start', columns: 1 });
    expect(slideLook('image_right')).toMatchObject({ picture: 'end', columns: 1 });
    expect(slideLook('two_column')).toMatchObject({ picture: 'top', columns: 2 });
    expect(slideLook('quote')).toMatchObject({ quote: true });
  });
});

describe('bullets as text', () => {
  it('turns lines into points and back, dropping blank lines', () => {
    expect(bulletLines('Roots\n\n  Stem \nLeaves\n')).toEqual(['Roots', 'Stem', 'Leaves']);
    expect(bulletsText(['Roots', 'Stem'])).toBe('Roots\nStem');
  });
});

describe('slideSpeech', () => {
  it('reads a slide’s words in order and skips the emoji', () => {
    expect(
      slideSpeech({
        ...blankSlide('content', 'Plants'),
        subtitle: 'Parts',
        content: 'Every plant has parts.',
        bullets: ['Roots', 'Stem'],
        emoji: '🌱',
      }),
    ).toBe('Plants\n\nParts\n\nEvery plant has parts.\n\nRoots\nStem');
    expect(slideSpeech(blankSlide('title'))).toBe('');
  });
});
