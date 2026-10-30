import { describe, expect, it } from 'vitest';
import {
  parseContentForm,
  parsePresentationRequestForm,
  parseSlides,
  parseSubPacketForm,
} from './assistant-forms.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('parseContentForm', () => {
  it('reads the request and turns number fields into numbers', () => {
    expect(
      parseContentForm(
        form([
          ['locale', 'es'],
          ['type', 'quiz'],
          ['subject', 'math'],
          ['grade', '4'],
          ['topic', ' Fracciones '],
          ['difficulty', 'easy'],
          ['questionCount', '8'],
          ['durationMinutes', ''],
          ['instructions', ''],
        ]),
      ),
    ).toEqual({
      locale: 'es',
      input: {
        type: 'quiz',
        subject: 'math',
        grade: '4',
        topic: 'Fracciones',
        difficulty: 'easy',
        questionCount: 8,
        language: 'es',
        instructions: null,
      },
    });
  });

  it('writes in the language chosen for the content, or the page’s language', () => {
    expect(
      parseContentForm(
        form([
          ['locale', 'en'],
          ['language', 'fr'],
        ]),
      ).input.language,
    ).toBe('fr');
    expect(parseContentForm(form([])).input).toMatchObject({ language: 'en', type: '' });
  });
});

describe('parsePresentationRequestForm', () => {
  it('reads the topic, slide count and theme', () => {
    expect(
      parsePresentationRequestForm(
        form([
          ['locale', 'es'],
          ['topic', 'Volcanes'],
          ['subject', 'science'],
          ['grade', '5'],
          ['slideCount', '6'],
          ['theme', 'forest'],
        ]),
      ),
    ).toEqual({
      locale: 'es',
      input: {
        topic: 'Volcanes',
        subject: 'science',
        grade: '5',
        slideCount: 6,
        theme: 'forest',
        language: 'es',
      },
    });
  });
});

describe('parseSlides', () => {
  it('reads the editor’s slides, keeping only known fields', () => {
    const json = JSON.stringify([
      { layout: 'content', title: 'Roots', bullets: ['a', 'b'], emoji: '🌱', extra: 'x' },
    ]);
    expect(parseSlides(json)).toEqual([
      { layout: 'content', title: 'Roots', bullets: ['a', 'b'], emoji: '🌱' },
    ]);
  });

  it('returns null for anything that is not a list of slides', () => {
    expect(parseSlides('not json')).toBeNull();
    expect(parseSlides('{"layout":"title"}')).toBeNull();
    expect(parseSlides('[{"title":"no layout"}]')).toBeNull();
    expect(parseSlides('[{"layout":"title","bullets":"no"}]')).toBeNull();
  });
});

describe('parseSubPacketForm', () => {
  it('reads the notes and the accommodations checkbox', () => {
    expect(
      parseSubPacketForm(
        form([
          ['locale', 'es'],
          ['classId', 'class-1'],
          ['mainOfficeExt', 'Ext. 100'],
          ['dailyRoutines', 'Fila a las 8'],
          ['includeAccommodations', 'on'],
        ]),
      ),
    ).toEqual({
      locale: 'es',
      classId: 'class-1',
      details: {
        mainOfficeExt: 'Ext. 100',
        nurseExt: null,
        dailyRoutines: 'Fila a las 8',
        emergencyProcedures: null,
        additionalNotes: null,
        includeAccommodations: true,
      },
    });
    expect(parseSubPacketForm(form([])).details.includeAccommodations).toBe(false);
  });
});
