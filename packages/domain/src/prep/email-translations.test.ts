import { describe, expect, it } from 'vitest';
import type {
  ClassId,
  GradeCategoryId,
  JobId,
  PrepBatchId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import {
  editTranslations,
  emailFor,
  failTranslations,
  familyLanguages,
  finishTranslations,
  startTranslations,
} from './email-translations.ts';
import { editEmail, startBatch, type PrepBatch } from './prep-batch.ts';
import { createPrepRequest } from './prep-request.ts';

const email = { subject: 'This week', body: 'Dear families,\n\n• Monday: Causes' };
const spanish = {
  language: 'es' as const,
  subject: 'Esta semana',
  body: 'Familias:\n\n• Lunes: Causas',
};
const chinese = { language: 'zh' as const, subject: '本周', body: '各位家长：\n\n• 星期一：原因' };

const ready = (): PrepBatch => {
  const request = valueOf(
    createPrepRequest({
      classId: 'c1' as ClassId,
      prompt: 'Prep the Civil War',
      weekStart: '2026-11-09',
      subject: 'social_studies',
      grade: '7',
      days: 1,
      options: { presentations: false, worksheets: false, quiz: false, parentEmail: true },
      quizCategoryId: 'cat1' as GradeCategoryId,
      language: 'en',
      emailTemplate: {
        subject: 's',
        greeting: 'g',
        intro: 'i',
        quizLine: 'q',
        signOff: 'o',
        dayLabels: ['M', 'T', 'W', 'T', 'F'],
      },
    }),
  );
  const started = startBatch({
    id: 'b1' as PrepBatchId,
    schoolId: 's1' as SchoolId,
    teacherId: 'u1' as UserId,
    request,
    jobId: 'j1' as JobId,
    createdAt: new Date('2026-11-05T12:00:00Z'),
  });
  return { ...started, status: 'ready', parentEmail: email };
};

describe('familyLanguages', () => {
  it("counts the families who read another language than the email's, one per address, in order", () => {
    const students = [
      { parentEmail: 'c@x.com', familyLanguage: 'zh' as const },
      { parentEmail: 'a@x.com', familyLanguage: 'es' as const },
      { parentEmail: 'a@x.com', familyLanguage: 'es' as const },
      { parentEmail: 'b@x.com', familyLanguage: 'es' as const },
      { parentEmail: 'd@x.com', familyLanguage: 'en' as const },
      { parentEmail: 'e@x.com', familyLanguage: null },
      { parentEmail: null, familyLanguage: 'fr' as const },
    ];
    expect(familyLanguages(students, 'en')).toEqual([
      { language: 'es', families: 2 },
      { language: 'zh', families: 1 },
    ]);
  });
});

describe('email translations', () => {
  it('start from the current email, then hold the drafts once made', () => {
    const started = valueOf(startTranslations(ready(), ['es', 'zh']));
    expect(started.translations).toEqual({
      status: 'running',
      languages: ['es', 'zh'],
      source: email,
      items: [],
    });
    const done = finishTranslations(started, email, [spanish, chinese]);
    expect(done.translations).toEqual({
      status: 'ready',
      languages: ['es', 'zh'],
      source: email,
      items: [spanish, chinese],
    });
  });

  it('cannot start without a ready email or languages to translate into', () => {
    expect(errorOf(startTranslations(ready(), []))).toEqual({
      field: 'languages',
      code: 'required',
    });
    expect(errorOf(startTranslations({ ...ready(), parentEmail: null }, ['es']))).toEqual({
      field: 'status',
      code: 'not_allowed',
    });
    expect(errorOf(startTranslations({ ...ready(), status: 'published' }, ['es']))).toEqual({
      field: 'status',
      code: 'not_allowed',
    });
  });

  it('drops drafts made from an email the teacher has since changed', () => {
    const started = valueOf(startTranslations(ready(), ['es']));
    const edited = valueOf(editEmail(started, { ...email, body: 'New text' }));
    expect(edited.translations).toBeNull();
    expect(finishTranslations(edited, email, [spanish])).toEqual(edited);
  });

  it('keeps the drafts when the email is saved unchanged', () => {
    const done = finishTranslations(valueOf(startTranslations(ready(), ['es'])), email, [spanish]);
    expect(valueOf(editEmail(done, { ...email })).translations).toEqual(done.translations);
  });

  it('records a failure, so the teacher can try again', () => {
    const started = valueOf(startTranslations(ready(), ['es']));
    expect(failTranslations(started, email).translations?.status).toBe('failed');
    expect(
      valueOf(startTranslations(failTranslations(started, email), ['es'])).translations?.status,
    ).toBe('running');
  });

  it("lets the teacher edit each draft, with the email's rules", () => {
    const done = finishTranslations(valueOf(startTranslations(ready(), ['es', 'zh'])), email, [
      spanish,
      chinese,
    ]);
    const edited = valueOf(editTranslations(done, [{ ...spanish, body: 'Familias, hola' }]));
    expect(edited.translations?.items).toEqual([{ ...spanish, body: 'Familias, hola' }, chinese]);
    expect(errorOf(editTranslations(done, [{ ...spanish, subject: ' ' }]))).toEqual({
      field: 'subject',
      code: 'required',
    });
    expect(errorOf(editTranslations(done, [{ ...spanish, language: 'fr' }]))).toEqual({
      field: 'language',
      code: 'not_allowed',
    });
  });

  it("gives each family its language's draft, or the teacher's email", () => {
    const done = finishTranslations(valueOf(startTranslations(ready(), ['es'])), email, [spanish]);
    expect(emailFor(done, 'es')).toEqual(spanish);
    expect(emailFor(done, 'zh')).toEqual({ language: 'en', ...email });
    expect(emailFor(valueOf(startTranslations(ready(), ['es'])), 'es')).toEqual({
      language: 'en',
      ...email,
    });
    expect(emailFor({ ...ready(), parentEmail: null }, 'es')).toBeNull();
  });
});
