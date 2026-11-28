import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogs, locales } from '@thp/i18n';
import { tourChapters, tourImage, tourScreens, tourSteps } from './demo-tour.ts';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

const text = (locale: (typeof locales)[number], path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      catalogs[locale],
    );

describe('the demo tour', () => {
  it('numbers its steps once each, in chapter order', () => {
    const ids = tourSteps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(tourSteps.map((s) => s.number)).toEqual(ids.map((_, i) => i + 1));
    expect(tourSteps[0]?.chapter).toBe(tourChapters[0]?.id);
  });

  it('picks one of its own screens to stand for each chapter in the overview video', () => {
    for (const chapter of tourChapters) {
      const own = tourSteps.filter((s) => s.chapter === chapter.id).map((s) => s.id);
      expect(own, chapter.id).toContain(chapter.hero);
    }
  });

  it('gives every chapter and step a title and words in every language', () => {
    for (const locale of locales) {
      for (const chapter of tourChapters) {
        expect(text(locale, `demo.chapters.${chapter.id}.title`), chapter.id).toEqual(
          expect.any(String),
        );
        expect(text(locale, `demo.chapters.${chapter.id}.intro`), chapter.id).toEqual(
          expect.any(String),
        );
      }
      for (const step of tourSteps) {
        for (const part of ['title', 'text', 'alt']) {
          expect(text(locale, `demo.steps.${step.id}.${part}`), `${locale}:${step.id}`).toEqual(
            expect.any(String),
          );
        }
      }
    }
  });

  it('has a screenshot of every step in every language', () => {
    const missing = locales.flatMap((locale) =>
      tourSteps
        .map((step) => tourImage(locale, step.id))
        .filter((src) => !existsSync(`${publicDir}${src}`)),
    );
    expect(missing).toEqual([]);
  });

  it('keeps each screenshot in its language folder, and shows students’ screens on a phone', () => {
    expect(tourImage('es', 'attendance')).toBe('/tour/es/attendance.jpg');
    expect(tourSteps.find((s) => s.id === 'studentAnswer')?.device).toBe('phone');
    expect(tourSteps.find((s) => s.id === 'gradebook')?.device).toBe('desktop');
    expect(tourScreens.phone.width).toBeLessThan(tourScreens.desktop.width);
  });
});
