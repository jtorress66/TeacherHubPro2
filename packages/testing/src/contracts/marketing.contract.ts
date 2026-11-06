import { describe, expect, it } from 'vitest';
import {
  createLead,
  startChatSession,
  type ChatSessionId,
  type ChatTurn,
  type ChatTurnId,
  type Lead,
  type LeadId,
} from '@thp/domain';
import type { ChatSessionRepository, ChatTurnQueue, LeadRepository } from '@thp/ports';

export interface MarketingStores {
  readonly leads: LeadRepository;
  readonly chatSessions: ChatSessionRepository;
  readonly chatTurns: ChatTurnQueue;
}

const aLead = (id: string, overrides: Partial<Parameters<typeof createLead>[0]> = {}): Lead => {
  const lead = createLead({
    id: id as LeadId,
    name: 'Ana Rivera',
    email: `${id}@school.edu`,
    organization: 'Lincoln Middle',
    role: 'teacher',
    phone: null,
    interest: 'features',
    source: 'chat',
    message: null,
    locale: 'en',
    page: '/en',
    now: new Date('2026-11-06T12:00:00Z'),
    ...overrides,
  });
  if (!lead.ok) throw new Error('invalid test lead');
  return lead.value;
};

const aSession = (id: string, at: string, visitor = 'visitor-1') =>
  startChatSession({
    id: id as ChatSessionId,
    tokenHash: `token-${id}`,
    visitorHash: visitor,
    role: 'teacher',
    interest: 'pricing',
    locale: 'en',
    page: '/en',
    now: new Date(at),
  });

const aTurn = (id: string, sessionId: string, at: string): ChatTurn => ({
  id: id as ChatTurnId,
  sessionId: sessionId as ChatSessionId,
  message: `Question ${id}`,
  reply: null,
  status: 'pending',
  createdAt: new Date(at),
});

/** Shared suites for the marketing site's storage: leads, chat sessions and the chat queue. */
export function marketingContract(name: string, make: () => MarketingStores): void {
  describe(`${name} (LeadRepository)`, () => {
    it('finds leads by text, score, source and status, newest first, and counts by score', async () => {
      const { leads } = make();
      const older = aLead('lead-1', { name: 'Ana Rivera', now: new Date('2026-11-01T00:00:00Z') });
      const newer = aLead('lead-2', {
        name: 'Ben District',
        role: 'district',
        source: 'contact',
        now: new Date('2026-11-05T00:00:00Z'),
      });
      await leads.save(older);
      await leads.save(newer);

      expect((await leads.search({ limit: 10 })).map((l) => l.id)).toEqual(['lead-2', 'lead-1']);
      expect((await leads.search({ text: 'RIVERA', limit: 10 })).map((l) => l.id)).toEqual([
        'lead-1',
      ]);
      expect((await leads.search({ score: 'high', limit: 10 })).map((l) => l.id)).toEqual([
        'lead-2',
      ]);
      expect((await leads.search({ source: 'chat', limit: 10 })).map((l) => l.id)).toEqual([
        'lead-1',
      ]);
      await leads.save({ ...older, status: 'contacted' });
      expect((await leads.search({ status: 'contacted', limit: 10 })).map((l) => l.id)).toEqual([
        'lead-1',
      ]);
      expect(await leads.findById('lead-1' as LeadId)).toMatchObject({ status: 'contacted' });
      expect(await leads.countByScore()).toEqual({ high: 1, medium: 1, low: 0 });
    });
  });

  describe(`${name} (ChatSessionRepository and ChatTurnQueue)`, () => {
    it('finds a session by its token hash and counts a visitor’s recent messages', async () => {
      const { chatSessions, chatTurns } = make();
      const session = aSession('chat-1', '2026-11-06T10:00:00Z');
      await chatSessions.save(session);
      await chatSessions.save(aSession('chat-2', '2026-11-06T10:00:00Z', 'visitor-2'));
      await chatTurns.enqueue(aTurn('turn-1', 'chat-1', '2026-11-06T10:05:00Z'));
      await chatTurns.enqueue(aTurn('turn-2', 'chat-1', '2026-11-06T11:30:00Z'));
      await chatTurns.enqueue(aTurn('turn-3', 'chat-2', '2026-11-06T11:30:00Z'));

      expect(await chatSessions.findByTokenHash('token-chat-1')).toEqual(session);
      expect(await chatSessions.findByTokenHash('nope')).toBeNull();
      expect(await chatSessions.findById('chat-1' as ChatSessionId)).toEqual(session);
      expect(
        await chatSessions.countVisitorMessagesSince('visitor-1', new Date('2026-11-06T11:00:00Z')),
      ).toBe(1);
    });

    it('hands out the oldest pending turn once, and keeps the answer', async () => {
      const { chatSessions, chatTurns } = make();
      await chatSessions.save(aSession('chat-1', '2026-11-06T10:00:00Z'));
      await chatTurns.enqueue(aTurn('turn-1', 'chat-1', '2026-11-06T10:05:00Z'));
      await chatTurns.enqueue(aTurn('turn-2', 'chat-1', '2026-11-06T10:06:00Z'));

      const first = await chatTurns.claimNext();
      expect(first?.id).toBe('turn-1');
      expect((await chatTurns.claimNext())?.id).toBe('turn-2');
      expect(await chatTurns.claimNext()).toBeNull();

      await chatTurns.answer('turn-1' as ChatTurnId, 'Hello!');
      await chatTurns.fail('turn-2' as ChatTurnId);
      expect(
        (await chatTurns.listForSession('chat-1' as ChatSessionId)).map((t) => [
          t.id,
          t.status,
          t.reply,
        ]),
      ).toEqual([
        ['turn-1', 'answered', 'Hello!'],
        ['turn-2', 'failed', null],
      ]);
    });

    it('deletes old chats with their turns', async () => {
      const { chatSessions, chatTurns } = make();
      await chatSessions.save(aSession('chat-old', '2026-09-01T00:00:00Z'));
      await chatSessions.save(aSession('chat-new', '2026-11-06T00:00:00Z'));
      await chatTurns.enqueue(aTurn('turn-old', 'chat-old', '2026-09-01T00:01:00Z'));

      expect(await chatSessions.deleteStartedBefore(new Date('2026-10-07T00:00:00Z'))).toBe(1);
      expect(await chatSessions.findById('chat-old' as ChatSessionId)).toBeNull();
      expect(await chatTurns.listForSession('chat-old' as ChatSessionId)).toEqual([]);
      expect(await chatSessions.findById('chat-new' as ChatSessionId)).not.toBeNull();
    });
  });
}
