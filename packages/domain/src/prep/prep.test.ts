import { describe, expect, it } from 'vitest';
import type { ExtractedTest } from '../assignments/extracted-test.ts';
import type { WeeklyDraft } from '../lesson-plans/plan-draft.ts';
import type { PresentationDraft } from '../presentations/presentation-request.ts';
import type {
  ClassId,
  GradeCategoryId,
  JobId,
  PrepBatchId,
  QuestionId,
  SchoolId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { parentEmailDraft, type EmailTemplate } from './parent-email.ts';
import {
  dayTopic,
  editEmail,
  finishBatch,
  markPublished,
  nextPending,
  prepProgress,
  publishable,
  recordDone,
  recordFailed,
  retryBatch,
  selectItems,
  startBatch,
  type PrepBatch,
} from './prep-batch.ts';
import { createPrepRequest, quizDay, type PrepRequestInput } from './prep-request.ts';

const template: EmailTemplate = {
  subject: 'This week in History 7',
  greeting: 'Dear families,',
  intro: 'Here is what we will learn this week:',
  quizLine: 'We will have a quiz on Friday.',
  signOff: 'Best regards,\nMs. Rivera',
  dayLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

const input: PrepRequestInput = {
  classId: 'c1' as ClassId,
  prompt: '  Prep next week for Unit 3 History (Civil War)  ',
  weekStart: '2026-11-09',
  subject: 'social_studies',
  grade: '7',
  days: 3,
  options: { presentations: true, worksheets: true, quiz: true, parentEmail: true },
  quizCategoryId: 'cat1' as GradeCategoryId,
  language: 'en',
  emailTemplate: template,
};

const request = () => {
  const created = createPrepRequest(input);
  if (!created.ok) throw new Error(created.error.code);
  return created.value;
};

const batch = (overrides: Partial<PrepRequestInput> = {}): PrepBatch => {
  const created = createPrepRequest({ ...input, ...overrides });
  if (!created.ok) throw new Error(created.error.code);
  return startBatch({
    id: 'b1' as PrepBatchId,
    schoolId: 's1' as SchoolId,
    teacherId: 'u1' as UserId,
    request: created.value,
    jobId: 'j1' as JobId,
    createdAt: new Date('2026-11-05T12:00:00Z'),
  });
};

const plan: WeeklyDraft = {
  kind: 'weekly',
  unit: 'Civil War',
  objective: 'Explain the causes of the Civil War.',
  skills: [],
  standards: [],
  expectations: null,
  days: [{ theme: 'Causes' }, { theme: null }, { theme: 'Battles' }, { theme: 'Extra' }],
};
const slides: PresentationDraft = { title: 'Causes', slides: [] };
const quiz: ExtractedTest = {
  instructions: null,
  questions: [
    {
      id: 'q1' as QuestionId,
      type: 'true_false',
      prompt: 'The war began in 1861.',
      points: 1,
      instructions: null,
      answer: true,
    },
  ],
};

/** Runs every item to done with simple content. */
function completeAll(start: PrepBatch): PrepBatch {
  let current = start;
  for (let item = nextPending(current); item !== null; item = nextPending(current)) {
    const content =
      item.kind === 'plan'
        ? plan
        : item.kind === 'presentation'
          ? slides
          : item.kind === 'worksheet'
            ? '# Worksheet'
            : quiz;
    current = recordDone(current, item.key, content);
  }
  return current;
}

describe('createPrepRequest', () => {
  it('trims the prompt and keeps the options', () => {
    expect(request()).toMatchObject({
      prompt: 'Prep next week for Unit 3 History (Civil War)',
      weekStart: '2026-11-09',
      days: 3,
      quizCategoryId: 'cat1',
    });
  });

  it('needs a Monday, 1 to 5 days, a prompt up to 500 characters and known values', () => {
    const code = (overrides: Partial<PrepRequestInput>) => {
      const result = createPrepRequest({ ...input, ...overrides });
      return result.ok ? null : result.error;
    };
    expect(code({ weekStart: '2026-11-10' })).toEqual({ field: 'weekStart', code: 'not_allowed' });
    expect(code({ days: 0 })).toEqual({ field: 'days', code: 'out_of_range' });
    expect(code({ days: 6 })).toEqual({ field: 'days', code: 'out_of_range' });
    expect(code({ prompt: ' ' })).toEqual({ field: 'prompt', code: 'required' });
    expect(code({ prompt: 'x'.repeat(501) })).toEqual({ field: 'prompt', code: 'too_long' });
    expect(code({ subject: 'art' })).toEqual({ field: 'subject', code: 'not_allowed' });
    expect(code({ grade: '13' })).toEqual({ field: 'grade', code: 'not_allowed' });
    expect(code({ language: 'xx' })).toEqual({ field: 'language', code: 'not_allowed' });
  });

  it('needs a grade category only when there is a quiz', () => {
    const noCategory = createPrepRequest({ ...input, quizCategoryId: null });
    expect(noCategory).toEqual({ ok: false, error: { field: 'quizCategoryId', code: 'required' } });
    const noQuiz = createPrepRequest({
      ...input,
      quizCategoryId: 'cat1' as GradeCategoryId,
      options: { ...input.options, quiz: false },
    });
    expect(noQuiz.ok && noQuiz.value.quizCategoryId).toBeNull();
  });

  it('puts the quiz on the Friday of the week', () => {
    expect(quizDay(request())).toBe('2026-11-13' as LocalDate);
  });
});

describe('a prep batch', () => {
  it('lists the plan, then slides and a worksheet per day, then the quiz', () => {
    expect(batch().items.map((item) => item.key)).toEqual([
      'plan',
      'presentation-1',
      'worksheet-1',
      'presentation-2',
      'worksheet-2',
      'presentation-3',
      'worksheet-3',
      'quiz',
    ]);
    const lean = batch({
      days: 2,
      options: { presentations: false, worksheets: true, quiz: false, parentEmail: false },
    });
    expect(lean.items.map((item) => item.key)).toEqual(['plan', 'worksheet-1', 'worksheet-2']);
    expect(lean.status).toBe('running');
  });

  it('reports the step it is on: plan, materials, quiz, then email', () => {
    let current = batch();
    expect(prepProgress(current)).toEqual({ step: 1, done: 0, total: 8 });
    current = recordDone(current, 'plan', plan);
    expect(prepProgress(current)).toEqual({ step: 2, done: 1, total: 8 });
    for (const key of ['presentation-1', 'worksheet-1', 'presentation-2', 'worksheet-2']) {
      current = recordDone(current, key, key.startsWith('worksheet') ? '# W' : slides);
    }
    current = recordFailed(current, 'presentation-3');
    current = recordDone(current, 'worksheet-3', '# W');
    expect(prepProgress(current)).toEqual({ step: 3, done: 7, total: 8 });
    current = recordDone(current, 'quiz', quiz);
    expect(nextPending(current)).toBeNull();
    expect(prepProgress(current)).toEqual({ step: 4, done: 8, total: 8 });
  });

  it('fails the whole batch when the plan fails, but only the item otherwise', () => {
    expect(recordFailed(batch(), 'plan').status).toBe('failed');
    const afterPlan = recordDone(batch(), 'plan', plan);
    const skipped = recordFailed(afterPlan, 'presentation-1');
    expect(skipped.status).toBe('running');
    expect(skipped.items.find((item) => item.key === 'presentation-1')).toMatchObject({
      status: 'failed',
      include: false,
    });
  });

  it('runs a failed batch again from the plan', () => {
    const failed = recordFailed(batch(), 'plan');
    const retried = retryBatch(failed);
    expect(retried.ok && retried.value.status).toBe('running');
    expect(retried.ok && nextPending(retried.value)?.key).toBe('plan');
    expect(retryBatch(batch()).ok).toBe(false);
  });

  it('uses each plan day theme as that day topic, or the prompt', () => {
    const current = recordDone(batch(), 'plan', plan);
    expect(dayTopic(current, 1)).toBe('Causes');
    expect(dayTopic(current, 2)).toBe('Prep next week for Unit 3 History (Civil War)');
    expect(dayTopic(batch(), 1)).toBe('Prep next week for Unit 3 History (Civil War)');
  });

  it('keeps Monday to Friday in the plan, blanking the days after the requested number', () => {
    const current = recordDone(batch(), 'plan', plan);
    const saved = current.items.find((item) => item.kind === 'plan');
    expect(saved?.kind === 'plan' && saved.content?.days).toEqual([
      { theme: 'Causes' },
      { theme: null },
      { theme: 'Battles' },
      {},
      {},
    ]);
  });

  it('becomes ready with the parent email draft', () => {
    const ready = finishBatch(completeAll(batch()), new Date('2026-11-05T12:05:00Z'));
    expect(ready.status).toBe('ready');
    expect(ready.readyAt).toEqual(new Date('2026-11-05T12:05:00Z'));
    expect(ready.parentEmail?.subject).toBe('This week in History 7');
    expect(ready.parentEmail?.body).toContain('Monday: Causes');
    const noEmail = finishBatch(
      completeAll(batch({ options: { ...input.options, parentEmail: false } })),
      new Date(),
    );
    expect(noEmail.parentEmail).toBeNull();
  });

  it('lets the teacher pick items and edit the email only once it is ready', () => {
    const running = batch();
    expect(selectItems(running, ['plan'])).toEqual({
      ok: false,
      error: { field: 'status', code: 'not_allowed' },
    });
    const ready = finishBatch(completeAll(batch()), new Date());
    const picked = selectItems(ready, ['plan', 'quiz', 'worksheet-1', 'unknown']);
    expect(picked.ok && publishable(picked.value).map((item) => item.key)).toEqual([
      'plan',
      'worksheet-1',
      'quiz',
    ]);
    const edited = editEmail(ready, { subject: ' Week 3 ', body: ' Hello ' });
    expect(edited.ok && edited.value.parentEmail).toEqual({ subject: 'Week 3', body: 'Hello' });
    expect(editEmail(ready, { subject: '', body: 'x' })).toEqual({
      ok: false,
      error: { field: 'subject', code: 'required' },
    });
    expect(editEmail(ready, { subject: 'x', body: 'y'.repeat(5001) })).toEqual({
      ok: false,
      error: { field: 'body', code: 'too_long' },
    });
  });

  it('never publishes the plan when it is unticked or a failed item', () => {
    const ready = finishBatch(
      completeAll(recordFailed(recordDone(batch(), 'plan', plan), 'worksheet-2')),
      new Date(),
    );
    expect(publishable(ready).map((item) => item.key)).not.toContain('worksheet-2');
  });
});

describe('markPublished', () => {
  const published = {
    planId: null,
    presentationIds: [],
    generationIds: [],
    assignmentId: null,
    emailsSent: 2,
    emailsFailed: 0,
  };

  it('publishes a ready batch once', () => {
    const ready = finishBatch(completeAll(batch()), new Date());
    const now = new Date('2026-11-06T09:00:00Z');
    const done = markPublished(ready, published, now);
    expect(done.ok && done.value).toMatchObject({
      status: 'published',
      publishedAt: now,
      published,
    });
    expect(done.ok && markPublished(done.value, published, now).ok).toBe(false);
    expect(markPublished(batch(), published, now).ok).toBe(false);
  });
});

describe('parentEmailDraft', () => {
  it('lists each day topic and the quiz line', () => {
    expect(parentEmailDraft({ template, dayThemes: ['Causes', 'Leaders'], hasQuiz: true })).toEqual(
      {
        subject: 'This week in History 7',
        body:
          'Dear families,\n\nHere is what we will learn this week:\n\n' +
          '• Monday: Causes\n• Tuesday: Leaders\n\n' +
          'We will have a quiz on Friday.\n\nBest regards,\nMs. Rivera',
      },
    );
  });

  it('leaves out the quiz line without a quiz', () => {
    expect(parentEmailDraft({ template, dayThemes: ['Causes'], hasQuiz: false }).body).toBe(
      'Dear families,\n\nHere is what we will learn this week:\n\n• Monday: Causes\n\n' +
        'Best regards,\nMs. Rivera',
    );
  });
});
