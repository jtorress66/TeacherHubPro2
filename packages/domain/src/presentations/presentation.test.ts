import { describe, expect, it } from 'vitest';
import type { PresentationId, SchoolId, UserId } from '../shared/ids.ts';
import {
  blankSlide,
  createPresentation,
  duplicateSlide,
  maxSlides,
  moveSlide,
  removeSlide,
  updatePresentation,
  type PresentationInput,
  type SlideInput,
} from './presentation.ts';
import { createPresentationRequest } from './presentation-request.ts';

const now = new Date('2026-10-30T12:00:00Z');
const slide = (overrides: Partial<SlideInput> = {}): SlideInput => ({
  layout: 'content',
  title: 'Parts of a plant',
  bullets: ['Roots', 'Stem', 'Leaves'],
  emoji: '🌱',
  ...overrides,
});
const input = (overrides: Partial<PresentationInput> = {}): PresentationInput => ({
  id: 'pres-1' as PresentationId,
  schoolId: 'school-1' as SchoolId,
  teacherId: 'teacher-1' as UserId,
  name: ' Plants ',
  slides: [slide({ layout: 'title', title: 'Plants', bullets: [] }), slide()],
  now,
  ...overrides,
});

describe('createPresentation', () => {
  it('fills defaults for the theme, details and each slide', () => {
    const result = createPresentation(input());

    expect(result.ok && result.value).toEqual({
      id: 'pres-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      name: 'Plants',
      topic: null,
      subject: null,
      grade: null,
      theme: 'ocean',
      slides: [
        {
          layout: 'title',
          title: 'Plants',
          subtitle: null,
          content: null,
          emoji: '🌱',
          bullets: [],
          transition: 'fade',
        },
        {
          layout: 'content',
          title: 'Parts of a plant',
          subtitle: null,
          content: null,
          emoji: '🌱',
          bullets: ['Roots', 'Stem', 'Leaves'],
          transition: 'fade',
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
  });

  it('keeps topic, subject, grade and theme when given', () => {
    const result = createPresentation(
      input({ topic: 'Plants', subject: 'science', grade: '3', theme: 'forest' }),
    );
    expect(result.ok && [result.value.topic, result.value.subject, result.value.grade]).toEqual([
      'Plants',
      'science',
      '3',
    ]);
    expect(result.ok && result.value.theme).toBe('forest');
  });

  it.each([
    [{ name: ' ' }, 'name', 'required'],
    [{ theme: 'neon' }, 'theme', 'not_allowed'],
    [{ subject: 'astrology' }, 'subject', 'not_allowed'],
    [{ grade: '13' }, 'grade', 'not_allowed'],
    [{ slides: [] }, 'slides', 'out_of_range'],
    [{ slides: Array.from({ length: maxSlides + 1 }, () => slide()) }, 'slides', 'out_of_range'],
    [{ slides: [slide({ layout: 'full_image' })] }, 'slides.0.layout', 'not_allowed'],
    [{ slides: [slide({ transition: 'spin' })] }, 'slides.0.transition', 'not_allowed'],
    [{ slides: [slide({ title: 'x'.repeat(201) })] }, 'slides.0.title', 'too_long'],
    [{ slides: [slide({ content: 'x'.repeat(2001) })] }, 'slides.0.content', 'too_long'],
    [
      { slides: [slide({ bullets: Array.from({ length: 9 }, () => 'b') })] },
      'slides.0.bullets',
      'out_of_range',
    ],
    [{ slides: [slide({ emoji: 'ab' })] }, 'slides.0.emoji', 'invalid_format'],
    [{ slides: [slide({ emoji: '🌱🌳' })] }, 'slides.0.emoji', 'invalid_format'],
  ] as const)('rejects %o', (overrides, field, code) => {
    expect(createPresentation(input(overrides as Partial<PresentationInput>))).toEqual({
      ok: false,
      error: { field, code },
    });
  });

  it('accepts emoji made of several code points and drops blank bullets', () => {
    const result = createPresentation(
      input({ slides: [slide({ emoji: '👩‍🔬', bullets: ['Observe', ' ', ''] })] }),
    );
    expect(result.ok && result.value.slides[0]).toMatchObject({
      emoji: '👩‍🔬',
      bullets: ['Observe'],
    });
  });
});

describe('updatePresentation', () => {
  it('replaces the details and slides and moves updatedAt only', () => {
    const created = createPresentation(input());
    if (!created.ok) throw new Error('bad');
    const later = new Date('2026-10-31T08:00:00Z');
    const updated = updatePresentation(
      created.value,
      { name: 'Plant life', theme: 'galaxy', slides: [slide({ title: 'Only one' })] },
      later,
    );

    expect(updated.ok && updated.value).toMatchObject({
      id: 'pres-1',
      name: 'Plant life',
      theme: 'galaxy',
      createdAt: now,
      updatedAt: later,
    });
    expect(updated.ok && updated.value.slides.map((s) => s.title)).toEqual(['Only one']);
  });

  it('refuses invalid changes', () => {
    const created = createPresentation(input());
    if (!created.ok) throw new Error('bad');
    expect(updatePresentation(created.value, { name: '', slides: [slide()] }, now).ok).toBe(false);
  });
});

describe('slide helpers', () => {
  const slides = ['a', 'b', 'c'].map((title) => blankSlide('content', title));

  it('starts a blank slide with the given layout and title', () => {
    expect(blankSlide('quote')).toEqual({
      layout: 'quote',
      title: '',
      subtitle: null,
      content: null,
      emoji: '',
      bullets: [],
      transition: 'fade',
    });
  });

  it('moves a slide, ignoring moves past either end', () => {
    expect(moveSlide(slides, 0, 2).map((s) => s.title)).toEqual(['b', 'c', 'a']);
    expect(moveSlide(slides, 2, 0).map((s) => s.title)).toEqual(['c', 'a', 'b']);
    expect(moveSlide(slides, 0, -1)).toBe(slides);
    expect(moveSlide(slides, 3, 0)).toBe(slides);
  });

  it('duplicates a slide right after itself, up to the slide limit', () => {
    expect(duplicateSlide(slides, 1).map((s) => s.title)).toEqual(['a', 'b', 'b', 'c']);
    const full = Array.from({ length: maxSlides }, () => blankSlide('content'));
    expect(duplicateSlide(full, 0)).toBe(full);
    expect(duplicateSlide(slides, 7)).toBe(slides);
  });

  it('removes a slide but never the last one', () => {
    expect(removeSlide(slides, 1).map((s) => s.title)).toEqual(['a', 'c']);
    const one = [blankSlide('title')];
    expect(removeSlide(one, 0)).toBe(one);
  });
});

describe('createPresentationRequest', () => {
  it('fills defaults: 6 slides and the ocean theme', () => {
    expect(
      createPresentationRequest({
        topic: 'Volcanoes',
        subject: 'science',
        grade: '5',
        language: 'es',
      }),
    ).toEqual({
      ok: true,
      value: {
        topic: 'Volcanoes',
        subject: 'science',
        grade: '5',
        slideCount: 6,
        theme: 'ocean',
        language: 'es',
      },
    });
  });

  it.each([
    [{ slideCount: 2 }, 'slideCount', 'out_of_range'],
    [{ slideCount: 13 }, 'slideCount', 'out_of_range'],
    [{ topic: '' }, 'topic', 'required'],
    [{ subject: 'astrology' }, 'subject', 'not_allowed'],
    [{ grade: 'X' }, 'grade', 'not_allowed'],
    [{ theme: 'neon' }, 'theme', 'not_allowed'],
    [{ language: 'ru' }, 'language', 'not_allowed'],
  ] as const)('rejects %o', (overrides, field, code) => {
    expect(
      createPresentationRequest({
        topic: 'Volcanoes',
        subject: 'science',
        grade: '5',
        language: 'es',
        ...overrides,
      }),
    ).toEqual({ ok: false, error: { field, code } });
  });
});
