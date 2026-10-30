import { describe, expect, it } from 'vitest';
import { createDraftRequest, type DraftRequest } from '@thp/domain';
import { unwrap } from '@thp/testing';
import { planFormats } from './plan-formats.ts';
import { reviewReply } from './reply-review.ts';

const request: DraftRequest = unwrap(
  createDraftRequest({
    kind: 'weekly',
    subject: 'math',
    grade: '4',
    topic: 'Comparing fractions',
    language: 'en',
    start: '2026-09-07',
  }),
);

const day = (theme: string) => ({ theme, dok: [1], activities: [], materials: [], notes: 'Plan' });
const reply = (overrides: Record<string, unknown> = {}) => ({
  text: JSON.stringify({
    objective: 'Compare fractions',
    skills: ['Compare'],
    standards: ['CCSS.Math.Content.4.NF.A.2'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day),
    ...overrides,
  }),
  stopReason: 'end' as const,
});

const review = (value: { text: string; stopReason: 'end' | 'max_tokens' }) =>
  reviewReply(planFormats.weekly, request, value);

describe('reviewReply', () => {
  it('returns the draft when the reply makes a valid plan', () => {
    const draft = unwrap(review(reply()));
    expect(draft).toMatchObject({ kind: 'weekly', standards: ['CCSS.Math.Content.4.NF.A.2'] });
  });

  it('says when the reply was cut off at the token limit', () => {
    const result = review({ ...reply(), stopReason: 'max_tokens' });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/cut off/) as unknown });
  });

  it('says when there is no JSON object', () => {
    expect(review({ text: 'Here you go', stopReason: 'end' })).toEqual({
      ok: false,
      error: expect.stringMatching(/not one JSON object/) as unknown,
    });
  });

  it('says when required fields are missing', () => {
    expect(review(reply({ days: [] }))).toEqual({
      ok: false,
      error: expect.stringMatching(/missing required fields/) as unknown,
    });
  });

  it('names the field that breaks a plan rule, and why', () => {
    const result = review(reply({ days: ['x'.repeat(201), 'b', 'c', 'd', 'e'].map(day) }));
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('"weeks.0.days.0.theme" is too long') as unknown,
    });
  });

  it('names a rule other than length by its code', () => {
    const draft = unwrap(review(reply()));
    const fiveSkills = {
      ...planFormats.weekly,
      parse: () => ({ ...draft, skills: ['1', '2', '3', '4', '5'] }),
    };

    expect(reviewReply(fiveSkills, request, reply())).toEqual({
      ok: false,
      error: expect.stringContaining('"weeks.0.skills" breaks a rule (out_of_range)') as unknown,
    });
  });
});
