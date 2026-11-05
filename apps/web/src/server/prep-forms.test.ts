import { describe, expect, it } from 'vitest';
import type { Class, ClassId } from '@thp/domain';
import { classDefaults, parseEmailForm, parsePrepForm, prepEmailTemplate } from './prep-forms.ts';

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('parsePrepForm', () => {
  it('reads the request, the ticked options and the number of days', () => {
    expect(
      parsePrepForm(
        form([
          ['locale', 'es'],
          ['classId', 'c1'],
          ['prompt', ' Unidad 3: la Guerra Civil '],
          ['weekStart', '2026-11-09'],
          ['subject', 'social_studies'],
          ['grade', '7'],
          ['days', '4'],
          ['options', 'quiz'],
          ['options', 'parentEmail'],
          ['quizCategoryId', 'cat1'],
          ['language', 'es'],
        ]),
      ),
    ).toEqual({
      locale: 'es',
      input: {
        classId: 'c1',
        prompt: 'Unidad 3: la Guerra Civil',
        weekStart: '2026-11-09',
        subject: 'social_studies',
        grade: '7',
        days: 4,
        options: { presentations: false, worksheets: false, quiz: true, parentEmail: true },
        quizCategoryId: 'cat1',
        language: 'es',
      },
    });
  });

  it('has no category when none is chosen, and writes in the page’s language by default', () => {
    const { input } = parsePrepForm(
      form([
        ['locale', 'en'],
        ['days', ''],
      ]),
    );
    expect(input.quizCategoryId).toBeNull();
    expect(input.language).toBe('en');
    expect(input.days).toBe(Number.NaN);
  });
});

describe('prepEmailTemplate', () => {
  it('fills the parent email wording in the chosen language', () => {
    const template = prepEmailTemplate('es', { className: 'Historia 7', teacherName: 'Ana López' });
    expect(template.subject).toContain('Historia 7');
    expect(template.signOff).toContain('Ana López');
    expect(template.dayLabels).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    expect(
      prepEmailTemplate('en', { className: 'History 7', teacherName: 'Ana' }).dayLabels[0],
    ).toBe('Monday');
  });
});

describe('parseEmailForm', () => {
  it('reads the kept items and the edited email', () => {
    expect(
      parseEmailForm(
        form([
          ['keep', 'plan'],
          ['keep', 'quiz'],
          ['emailSubject', ' Semana 3 '],
          ['emailBody', 'Hola'],
        ]),
      ),
    ).toEqual({ keep: ['plan', 'quiz'], email: { subject: 'Semana 3', body: 'Hola' } });
    expect(parseEmailForm(form([['keep', 'plan']]))).toEqual({ keep: ['plan'] });
  });
});

describe('classDefaults', () => {
  const cls = (subject: string | null, grade: string | null) =>
    ({ id: 'c1' as ClassId, subject, grade }) as Class;

  it('uses the class’s subject and grade when they match the options', () => {
    expect(classDefaults(cls('Math', '4'))).toEqual({ subject: 'math', grade: '4' });
    expect(classDefaults(cls('Social Studies', '7th'))).toEqual({
      subject: 'social_studies',
      grade: '7',
    });
    expect(classDefaults(cls('Ciencias', 'K'))).toEqual({ subject: 'science', grade: 'K' });
    expect(classDefaults(cls(null, 'Kindergarten'))).toEqual({ subject: null, grade: null });
  });
});
