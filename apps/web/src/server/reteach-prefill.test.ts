import { describe, expect, it } from 'vitest';
import { describeStandard, maxShortTextLength, type StandardCoverage } from '@thp/domain';
import { createTranslator, locales } from '@thp/i18n';
import { assistantStart, reteachHref, reteachValues } from './reteach-prefill.ts';

const fractions = 'CCSS.Math.Content.4.NF.A.1';
const row = (overrides: Partial<StandardCoverage> = {}): StandardCoverage => ({
  standard: describeStandard(fractions),
  plannedWeeks: [],
  assignments: 2,
  average: 62,
  studentsScored: 20,
  studentsBelow: 9,
  status: 'reteach',
  ...overrides,
});
const cls = { subject: 'Math', grade: '4' };

describe('reteachValues', () => {
  it('fills a reteach lesson with the standard, the class results and the teacher’s language', () => {
    const values = reteachValues('es', row(), cls, 'lesson');
    const t = createTranslator('es');

    expect(values).toMatchObject({
      type: 'lesson_plan',
      subject: 'math',
      grade: '4',
      language: 'es',
      durationMinutes: '30',
      followCurriculum: 'on',
    });
    expect(values.topic).toContain(fractions);
    expect(values.instructions).toBe(
      t('standards.reteachLessonInstructions', {
        code: fractions,
        average: 62,
        below: 9,
        scored: 20,
        percent: 70,
      }),
    );
    expect(values.instructions).not.toMatch(/Zayas|Ana/u);
  });

  it('fills a five-question re-check quiz on the same standard', () => {
    const values = reteachValues('en', row({ status: 'watch', average: 74 }), cls, 'quiz');

    expect(values).toMatchObject({ type: 'quiz', questionCount: '5' });
    expect(values.instructions).toContain(fractions);
  });

  it('leaves the subject and grade to the form when the class does not name a known one', () => {
    const values = reteachValues(
      'en',
      row(),
      { subject: 'Matemáticas 4B', grade: 'cuarto' },
      'lesson',
    );

    expect(values.subject).toBeUndefined();
    expect(values.grade).toBeUndefined();
  });

  it('reads the subject from the class in any language, and a grade like "4th"', () => {
    expect(
      reteachValues('en', row(), { subject: 'matemáticas', grade: '4th' }, 'lesson'),
    ).toMatchObject({ subject: 'math', grade: '4' });
    expect(reteachValues('en', row(), { subject: 'Science', grade: 'K' }, 'lesson')).toMatchObject({
      subject: 'science',
      grade: 'K',
    });
  });

  it('keeps a long official description within the topic’s limit', () => {
    const long = row({
      standard: { code: 'X.1', source: 'typed', description: 'word '.repeat(80) },
    });

    expect(reteachValues('en', long, cls, 'lesson').topic.length).toBeLessThanOrEqual(
      maxShortTextLength,
    );
  });
});

describe('reteach button names', () => {
  it('say the visible words first, then the code, in every language (WCAG label in name)', () => {
    for (const locale of locales) {
      const t = createTranslator(locale);
      expect(t('standards.reteachLessonFor', { code: 'X.1' }), locale).toContain(
        t('standards.reteachLesson'),
      );
      expect(t('standards.reteachQuizFor', { code: 'X.1' }), locale).toContain(
        t('standards.reteachQuiz'),
      );
    }
  });
});

describe('reteachHref', () => {
  it('opens the assistant with the values in the link', () => {
    const href = reteachHref('en', row(), cls, 'lesson');
    const url = new URL(href, 'https://example.test');

    expect(url.pathname).toBe('/en/app/assistant');
    expect(url.searchParams.get('type')).toBe('lesson_plan');
    expect(url.searchParams.get('topic')).toContain(fractions);
  });
});

describe('assistantStart', () => {
  it('starts the form from a reteach link', () => {
    const values = reteachValues('es', row(), cls, 'quiz');
    const search = Object.fromEntries(new URLSearchParams(values));

    expect(assistantStart(search)).toEqual(values);
  });

  it('ignores anything that is not a valid starting value', () => {
    expect(assistantStart({})).toBeUndefined();
    expect(
      assistantStart({
        type: 'poem',
        subject: 'cooking',
        grade: '13',
        language: 'xx',
        durationMinutes: '999',
        questionCount: '0',
        topic: 'x'.repeat(maxShortTextLength + 1),
        evil: 'yes',
      }),
    ).toBeUndefined();
    expect(assistantStart({ type: 'quiz', evil: 'yes' })).toEqual({
      type: 'quiz',
      followCurriculum: 'on',
    });
  });
});
