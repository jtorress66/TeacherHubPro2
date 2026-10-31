import { describe, expect, it } from 'vitest';
import { createExtractedTest } from '@thp/domain';
import { unwrap } from '@thp/testing';
import { extractorMetrics, scoreExtraction } from './extractor-scorecard.ts';
import { graderMetrics, scoreGrading } from '../submission-grader/grader-scorecard.ts';

const test = unwrap(
  createExtractedTest({
    instructions: null,
    questions: [
      {
        type: 'fill_blank',
        prompt: 'The ___ is red.',
        acceptedAnswers: ['apple'],
        instructions: 'Word bank: apple, sky',
      },
      {
        type: 'fill_blank',
        prompt: 'The ___ is blue.',
        acceptedAnswers: ['sky'],
        instructions: 'Word bank: apple, sky',
      },
      { type: 'true_false', prompt: 'Water is wet.', answer: true },
    ],
  }),
);

describe('scoreExtraction', () => {
  const expected = {
    types: ['fill_blank', 'fill_blank', 'true_false'] as const,
    instructionsContain: 'Word bank',
  };

  it('scores a faithful extraction as all ones', () => {
    expect(scoreExtraction(expected, test)).toEqual({
      structure: 1,
      questionCount: 1,
      types: 1,
      instructions: 1,
    });
    expect(extractorMetrics).toEqual(['structure', 'questionCount', 'types', 'instructions']);
  });

  it('notices a wrong count, wrong types and a lost word bank', () => {
    expect(
      scoreExtraction(
        {
          types: ['fill_blank', 'multiple_choice', 'true_false', 'essay'],
          instructionsContain: 'Passage',
        },
        test,
      ),
    ).toEqual({ structure: 1, questionCount: 0, types: 0.5, instructions: 0 });
  });

  it('scores a missing result as failing', () => {
    expect(scoreExtraction(expected, null)).toEqual({
      structure: 0,
      questionCount: 0,
      types: 0,
      instructions: 0,
    });
  });
});

describe('scoreGrading', () => {
  const request = {
    language: 'en' as const,
    questions: [
      { id: 'q1', points: 10 },
      { id: 'q2', points: 4 },
    ],
  };
  const bands = { q1: [0.6, 1], q2: [0, 0.25] } as const;

  it('checks each score falls in its expected band and the feedback language', () => {
    const scores = {
      scores: {
        q1: { score: 8, feedback: 'You explained the cycle well and the steps are clear.' },
        q2: { score: 0, feedback: 'The answer does not match the question yet.' },
      },
      feedback: 'Keep going with the good work.',
    };
    expect(scoreGrading(request, bands, scores)).toEqual({ structure: 1, band: 1, language: 1 });
    expect(graderMetrics).toEqual(['structure', 'band', 'language']);
  });

  it('notices scores outside their band and a missing result', () => {
    const scores = {
      scores: {
        q1: { score: 2, feedback: 'The answer is short.' },
        q2: { score: 4, feedback: 'The answer is right.' },
      },
      feedback: 'Thanks for the work.',
    };
    expect(scoreGrading(request, bands, scores)).toMatchObject({ band: 0 });
    expect(scoreGrading(request, bands, null)).toEqual({ structure: 0, band: 0, language: 0 });
  });
});
