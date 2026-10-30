import { describe, expect, it } from 'vitest';
import { createDraftRequest, type DraftRequestInput, type LessonPlanDraft } from '@thp/domain';
import { aWeeklyDraft, unwrap } from '@thp/testing';
import {
  averageScores,
  belowThreshold,
  detectLanguage,
  draftText,
  scorePlan,
  type PlanScores,
} from './plan-scorecard.ts';

const request = (overrides: Partial<DraftRequestInput> = {}) =>
  unwrap(
    createDraftRequest({
      kind: 'weekly',
      subject: 'math',
      grade: '4',
      topic: 'Fractions',
      language: 'en',
      start: '2026-09-07',
      ...overrides,
    }),
  );

const englishDay = { theme: 'Hook', notes: 'The students compare fractions with their partners.' };
const fullDraft = aWeeklyDraft({
  objective: 'Students compare fractions and explain their reasoning.',
  days: [englishDay, englishDay, englishDay, englishDay, englishDay],
});
const raw = (standards: string[]) => JSON.stringify({ standards });

describe('detectLanguage', () => {
  it.each([
    ['en', 'The students read the story and answer the questions with their partner.'],
    ['es', 'Los estudiantes leen el cuento y responden las preguntas con su pareja para el lunes.'],
    [
      'fr',
      'Les élèves lisent le texte et répondent aux questions avec leur partenaire pour la classe.',
    ],
    ['pt', 'Os alunos leem a história e respondem às perguntas com o colega para a aula.'],
    [
      'de',
      'Die Schüler lesen die Geschichte und beantworten die Fragen mit dem Partner für das Thema.',
    ],
    [
      'it',
      'Gli studenti leggono la storia e rispondono alle domande con il compagno per la classe.',
    ],
    ['zh', '学生阅读故事并与同伴一起回答问题。'],
  ] as const)('recognises %s', (language, text) => {
    expect(detectLanguage(text)).toBe(language);
  });
});

describe('scorePlan', () => {
  it('gives full marks to a complete English draft with official codes', () => {
    expect(scorePlan(request(), fullDraft, raw(['CCSS.Math.Content.4.NF.A.1']))).toEqual({
      structure: 1,
      language: 1,
      validCodes: 1,
      complete: 1,
      relevantCodes: 1,
    });
  });

  it('measures invented or off-grade codes the model cited before they were dropped', () => {
    const scores = scorePlan(
      request(),
      fullDraft,
      raw([
        'CCSS.Math.Content.4.NF.A.1',
        'CCSS.Math.Content.4.NF.Z.9',
        'CCSS.Math.Content.7.NS.A.1',
        'PR.1',
      ]),
    );
    expect(scores.validCodes).toBe(0.25);
  });

  it('expects codes when some fit, and none when the list is empty', () => {
    expect(scorePlan(request(), fullDraft, raw([])).relevantCodes).toBe(0);
    const k5Science = request({ subject: 'science', grade: '3' });
    expect(scorePlan(k5Science, fullDraft, raw([])).relevantCodes).toBe(1);
    expect(
      scorePlan(k5Science, fullDraft, raw(['CCSS.ELA-Literacy.RST.6-8.1'])).relevantCodes,
    ).toBe(0);
  });

  it('marks the wrong language and empty days', () => {
    const scores = scorePlan(request({ language: 'es' }), aWeeklyDraft(), 'no json');
    expect(scores).toMatchObject({ language: 0, complete: 0, validCodes: 1 });
  });

  it('scores a missing draft as zero', () => {
    expect(scorePlan(request(), null, 'oops')).toEqual({
      structure: 0,
      language: 0,
      validCodes: 1,
      complete: 0,
      relevantCodes: 0,
    });
  });

  it('scores Conversational English drafts on their sections', () => {
    const ce: LessonPlanDraft = {
      kind: 'conversational_english',
      title: 'Restaurant',
      topic: null,
      learningObjectives: 'The students order a meal with their partner.',
      materials: null,
      hook: 'Guess the dish',
      learningGoal: null,
      closure: 'Role play',
      notes: 'I would like ___',
    };
    const ceRequest = request({
      kind: 'conversational_english',
      subject: null,
      start: '2026-09-09',
    });
    expect(scorePlan(ceRequest, ce, raw([]))).toMatchObject({
      structure: 1,
      language: 1,
      complete: 1,
      relevantCodes: 1,
    });
    expect(draftText(ce)).toContain('Guess the dish');
    expect(scorePlan(ceRequest, { ...ce, closure: null }, raw([])).complete).toBe(0);
  });
});

describe('averaging and thresholds', () => {
  const perfect: PlanScores = {
    structure: 1,
    language: 1,
    validCodes: 1,
    complete: 1,
    relevantCodes: 1,
  };

  it('averages each metric', () => {
    expect(averageScores([perfect, { ...perfect, relevantCodes: 0, validCodes: 0.5 }])).toEqual({
      ...perfect,
      relevantCodes: 0.5,
      validCodes: 0.75,
    });
    expect(averageScores([]).structure).toBe(0);
  });

  it('lists the metrics under their threshold', () => {
    const thresholds = {
      structure: 1,
      language: 1,
      validCodes: 1,
      complete: 1,
      relevantCodes: 0.8,
    };
    expect(belowThreshold(perfect, thresholds)).toEqual([]);
    expect(belowThreshold({ ...perfect, relevantCodes: 0.5, language: 0.9 }, thresholds)).toEqual([
      'language',
      'relevantCodes',
    ]);
  });
});
