import { describe, expect, it } from 'vitest';
import { createTranslator } from '@thp/i18n';
import {
  formatDuration,
  gameFormErrors,
  gameModeChoices,
  kindForMode,
  parseConfirmScores,
  parseGameDraftForm,
  parseGameForm,
  parseGradingForm,
} from './game-forms.ts';

const form = (values: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
};

describe('game forms', () => {
  it('offers "all modes" and every mode, each with its kind of content', () => {
    expect(gameModeChoices[0]).toBe('all');
    expect(gameModeChoices).toHaveLength(12);
    expect(kindForMode('all')).toBe('pairs');
    expect(kindForMode('quiz')).toBe('questions');
    expect(kindForMode('drag_drop')).toBe('groups');
    expect(kindForMode('chess')).toBe('questions');
  });

  it('reads a game form, parsing the content for the chosen mode', () => {
    const parsed = parseGameForm(
      form({
        locale: 'es',
        title: ' Planetas ',
        mode: 'sequence',
        content: 'Uno\nDos\nTres',
        classId: 'class-1',
        language: 'fr',
      }),
    );
    expect(parsed).toEqual({
      locale: 'es',
      input: {
        title: 'Planetas',
        mode: 'sequence',
        content: { kind: 'steps', items: ['Uno', 'Dos', 'Tres'] },
        classId: 'class-1',
        language: 'fr',
      },
    });
    const noClass = parseGameForm(form({ title: 'T', mode: 'quiz', content: '', classId: '' }));
    expect(noClass.locale).toBe('en');
    expect(noClass.input.classId).toBeNull();
    expect(noClass.input.language).toBe('en');
  });

  it('puts an item’s error under the content, numbered from 1', () => {
    const t = createTranslator('en');
    expect(gameFormErrors({ field: 'items.2.term', code: 'duplicate' }, 'en')).toEqual({
      content: t('games.itemError', { item: 3, message: t('errors.duplicate') }),
    });
    expect(gameFormErrors({ field: 'items', code: 'too_short' }, 'en')).toEqual({
      content: t('games.tooFewItems'),
    });
    expect(gameFormErrors({ field: 'title', code: 'required' }, 'es')).toEqual({
      title: createTranslator('es')('errors.required'),
    });
  });

  it('reads the grading form', () => {
    expect(
      parseGradingForm(
        form({ countAsGrade: 'on', method: 'average', points: '20', categoryId: 'cat-1' }),
      ),
    ).toEqual({ countAsGrade: true, method: 'average', points: 20, categoryId: 'cat-1' });
    expect(parseGradingForm(form({ method: 'best', points: '', categoryId: '' }))).toEqual({
      countAsGrade: false,
      method: 'best',
      points: Number.NaN,
      categoryId: null,
    });
  });

  it('reads the AI draft form, with the kind for its mode', () => {
    expect(
      parseGameDraftForm(
        form({
          locale: 'es',
          mode: 'word_search',
          subject: 'science',
          grade: '4',
          topic: ' El espacio ',
          count: '10',
          language: 'xx',
          gameId: 'game-1',
        }),
      ),
    ).toEqual({
      locale: 'es',
      mode: 'word_search',
      input: {
        kind: 'pairs',
        subject: 'science',
        grade: '4',
        topic: 'El espacio',
        count: 10,
        language: 'es',
        gameId: 'game-1',
      },
    });
    const plain = parseGameDraftForm(
      form({ mode: 'quiz', subject: 'math', grade: '2', topic: 'Sumas' }),
    );
    expect(plain.input).not.toHaveProperty('count');
    expect(plain.input).not.toHaveProperty('gameId');
  });

  it('reads the adjusted scores, leaving blanks to the draft', () => {
    expect(
      parseConfirmScores(form({ 'score:student-1': '8.5', 'score:student-2': '', other: '3' })),
    ).toEqual({ 'student-1': 8.5 });
  });

  it('formats a play’s time as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_400)).toBe('1:05');
    expect(formatDuration(3_600_000)).toBe('60:00');
  });
});
