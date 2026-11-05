import { describe, expect, it } from 'vitest';
import type { PresentationId, SchoolId, UserId } from '../shared/ids.ts';
import { presentationThemes, type Presentation, type Slide } from './presentation.ts';
import { slideThemeColours, toGoogleSlides } from './google-slides.ts';

const slide = (overrides: Partial<Slide>): Slide => ({
  layout: 'content',
  title: '',
  subtitle: null,
  content: null,
  emoji: '',
  bullets: [],
  transition: 'none',
  ...overrides,
});

const presentation = (slides: readonly Slide[], theme: Presentation['theme'] = 'forest') =>
  ({
    id: 'p1' as PresentationId,
    schoolId: 's1' as SchoolId,
    teacherId: 'u1' as UserId,
    name: 'Volcanoes',
    topic: null,
    subject: null,
    grade: null,
    theme,
    slides,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) satisfies Presentation;

describe('toGoogleSlides', () => {
  it('names the deck and colours it with the theme', () => {
    const deck = toGoogleSlides(presentation([slide({ title: 'Hi' })]));
    expect(deck.name).toBe('Volcanoes');
    expect(deck.colours).toEqual(slideThemeColours.forest);
  });

  it('puts the emoji before the title and uses a title slide for the title layout', () => {
    const deck = toGoogleSlides(
      presentation([
        slide({ layout: 'title', title: 'Volcanoes', subtitle: 'Mountains of fire', emoji: '🌋' }),
      ]),
    );
    expect(deck.slides).toEqual([
      {
        layout: 'title',
        title: '🌋 Volcanoes',
        body: [{ text: 'Mountains of fire', bullet: false }],
      },
    ]);
  });

  it('writes the subtitle, then the content, then the bullets, marking only the bullets', () => {
    const deck = toGoogleSlides(
      presentation([
        slide({
          layout: 'two_column',
          title: 'How they form',
          subtitle: 'Under the crust',
          content: 'Magma rises.\nPressure builds.',
          bullets: ['Heat', 'Pressure'],
        }),
      ]),
    );
    expect(deck.slides[0]).toEqual({
      layout: 'body',
      title: 'How they form',
      body: [
        { text: 'Under the crust', bullet: false },
        { text: 'Magma rises.', bullet: false },
        { text: 'Pressure builds.', bullet: false },
        { text: 'Heat', bullet: true },
        { text: 'Pressure', bullet: true },
      ],
    });
  });

  it('leaves out empty text', () => {
    const deck = toGoogleSlides(
      presentation([slide({ title: '  ', content: ' \n ', bullets: ['', ' One '] })]),
    );
    expect(deck.slides[0]).toEqual({
      layout: 'body',
      title: '',
      body: [{ text: 'One', bullet: true }],
    });
  });

  it('has a background and text colour for every theme', () => {
    for (const theme of presentationThemes) {
      expect(slideThemeColours[theme].background).toMatch(/^#[0-9a-f]{6}$/u);
      expect(slideThemeColours[theme].text).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});
