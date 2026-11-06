import { describe, expect, it } from 'vitest';
import { planCatalog, planIds, trialDays } from '../billing/plan-catalog.ts';
import type { ChatSessionId, LeadId } from '../shared/ids.ts';
import { chatLimits, checkChatMessage, canSendChatMessage, startChatSession } from './chat.ts';
import { chatFacts, productFeatures } from './facts.ts';
import { createLead, scoreLead, type LeadInput } from './lead.ts';

const now = new Date('2026-11-06T12:00:00Z');

const lead = (overrides: Partial<LeadInput> = {}) =>
  createLead({
    id: 'l1' as LeadId,
    name: '  Ana Rivera ',
    email: 'Ana@School.edu',
    organization: 'Lincoln Middle',
    role: 'teacher',
    phone: null,
    interest: 'features',
    source: 'chat',
    message: null,
    locale: 'en',
    page: '/en/pricing',
    now,
    ...overrides,
  });

describe('createLead', () => {
  it('keeps a trimmed lead with a normalised email and its score', () => {
    const created = lead();
    expect(created.ok && created.value).toMatchObject({
      name: 'Ana Rivera',
      email: 'ana@school.edu',
      score: 'medium',
      status: 'new',
      createdAt: now,
    });
  });

  it('needs a name and a valid email, and keeps texts short', () => {
    expect(lead({ name: ' ' })).toEqual({ ok: false, error: { field: 'name', code: 'required' } });
    expect(lead({ email: 'nope' }).ok).toBe(false);
    expect(lead({ message: 'x'.repeat(2001) })).toEqual({
      ok: false,
      error: { field: 'message', code: 'too_long' },
    });
    expect(lead({ source: 'spam' as never })).toEqual({
      ok: false,
      error: { field: 'source', code: 'not_allowed' },
    });
  });
});

describe('scoreLead', () => {
  it('is high for district, school leaders and enterprise or demo interest', () => {
    for (const role of ['district', 'school_admin', 'principal']) {
      expect(scoreLead({ role, interest: 'features', email: null })).toBe('high');
    }
    for (const interest of ['demo', 'enterprise']) {
      expect(scoreLead({ role: 'teacher', interest, email: null })).toBe('high');
    }
  });

  it('is medium for pricing or school interest, or anyone who leaves an email', () => {
    expect(scoreLead({ role: 'parent', interest: 'pricing', email: null })).toBe('medium');
    expect(scoreLead({ role: 'tutor', interest: 'school', email: null })).toBe('medium');
    expect(scoreLead({ role: 'teacher', interest: 'features', email: 'a@b.co' })).toBe('medium');
  });

  it('is low otherwise', () => {
    expect(scoreLead({ role: 'other', interest: 'other', email: null })).toBe('low');
  });
});

describe('chat sessions', () => {
  it('starts with the visitor’s role, interest, language and page', () => {
    expect(
      startChatSession({
        id: 'c1' as ChatSessionId,
        tokenHash: 'h',
        visitorHash: 'v',
        role: 'teacher',
        interest: 'pricing',
        locale: 'es',
        page: '/es',
        now,
      }),
    ).toMatchObject({ role: 'teacher', interest: 'pricing', locale: 'es', turns: 0 });
  });

  it('takes messages of 1 to 1000 characters', () => {
    expect(checkChatMessage('  hi ')).toEqual({ ok: true, value: 'hi' });
    expect(checkChatMessage(' ')).toEqual({
      ok: false,
      error: { field: 'message', code: 'required' },
    });
    expect(checkChatMessage('x'.repeat(1001))).toEqual({
      ok: false,
      error: { field: 'message', code: 'too_long' },
    });
  });

  it('stops a session after 20 turns and a visitor after 60 messages an hour', () => {
    expect(chatLimits).toEqual({ turnsPerSession: 20, messagesPerHour: 60 });
    expect(canSendChatMessage({ sessionTurns: 19, visitorMessagesLastHour: 59 })).toBe(true);
    expect(canSendChatMessage({ sessionTurns: 20, visitorMessagesLastHour: 0 })).toBe(false);
    expect(canSendChatMessage({ sessionTurns: 0, visitorMessagesLastHour: 60 })).toBe(false);
  });
});

describe('chatFacts', () => {
  it('states every plan with its catalog price, seats and the trial', () => {
    const facts = chatFacts();
    expect(facts.trialDays).toBe(trialDays);
    expect(facts.plans.map((p) => p.id)).toEqual([...planIds]);
    for (const plan of facts.plans) {
      expect(plan.price).toBe(planCatalog[plan.id].priceCents / 100);
      expect(plan.minimumTeachers).toBe(planCatalog[plan.id].minimumSeats);
    }
    expect(facts.plans.find((p) => p.id === 'school')?.billedYearly).toBe(true);
  });

  it('lists only features the app has', () => {
    expect(productFeatures).toContain('lesson_planner');
    expect(productFeatures).toContain('prep_agent');
    expect(productFeatures).not.toContain('sso');
    expect(chatFacts().features).toEqual(productFeatures);
  });
});
