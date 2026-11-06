import { describe, expect, it } from 'vitest';
import type { LeadId } from '@thp/domain';
import {
  aUser,
  FakeChatbotWriter,
  InMemoryChat,
  InMemoryLeadRepository,
  unavailableChatbot,
} from '@thp/testing';
import {
  CaptureLead,
  GetChat,
  ListLeads,
  RunNextChatTurn,
  SendChatMessage,
  StartChat,
  SweepOldChats,
  UpdateLeadStatus,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { advanceDays, makeWorld } from './world.ts';

function marketingWorld(notify: string | null = 'team@teacherhubpro.com') {
  const world = makeWorld();
  const chat = new InMemoryChat();
  return {
    ...world,
    chatSessions: chat,
    chatTurns: chat,
    leads: new InMemoryLeadRepository(),
    leadsNotifyEmail: notify,
  };
}
type MarketingWorld = ReturnType<typeof marketingWorld>;

const superAdmin = aUser({ role: 'super_admin' });
const teacher = aUser();

async function chatting(world: MarketingWorld, visitor = '203.0.113.7') {
  return valueOf(
    await new StartChat(world).execute({
      role: 'teacher',
      interest: 'pricing',
      locale: 'es',
      page: '/es/pricing',
      visitor,
    }),
  );
}

describe('the website chat', () => {
  it('queues a message, answers it in the worker, and shows the reply to that visitor only', async () => {
    const world = marketingWorld();
    const { token } = await chatting(world);
    const writer = new FakeChatbotWriter();
    valueOf(
      await new SendChatMessage(world).execute({
        token,
        message: ' ¿Cuánto cuesta? ',
        visitor: 'x',
      }),
    );
    expect(await new RunNextChatTurn({ ...world, chatbot: writer }).execute()).toBe('answered');
    expect(await new RunNextChatTurn({ ...world, chatbot: writer }).execute()).toBe('idle');

    const turns = valueOf(await new GetChat(world).execute({ token }));
    expect(turns.map((t) => [t.message, t.status, t.reply])).toEqual([
      ['¿Cuánto cuesta?', 'answered', 'Happy to help!'],
    ]);
    expect(writer.requests[0]).toMatchObject({
      language: 'es',
      role: 'teacher',
      interest: 'pricing',
      history: [],
      message: '¿Cuánto cuesta?',
    });
    expect(writer.requests[0]?.facts.plans.length).toBe(4);
    expect(await new GetChat(world).execute({ token: 'someone-else' })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('sends the earlier exchanges as context, and marks a turn failed when the AI is down', async () => {
    const world = marketingWorld();
    const { token } = await chatting(world);
    const writer = new FakeChatbotWriter();
    valueOf(await new SendChatMessage(world).execute({ token, message: 'Hola', visitor: 'x' }));
    await new RunNextChatTurn({ ...world, chatbot: writer }).execute();
    valueOf(
      await new SendChatMessage(world).execute({ token, message: '¿Y la escuela?', visitor: 'x' }),
    );
    await new RunNextChatTurn({ ...world, chatbot: writer }).execute();
    expect(writer.requests[1]?.history).toEqual([
      { from: 'visitor', text: 'Hola' },
      { from: 'assistant', text: 'Happy to help!' },
    ]);

    valueOf(await new SendChatMessage(world).execute({ token, message: 'Otra', visitor: 'x' }));
    expect(await new RunNextChatTurn({ ...world, chatbot: unavailableChatbot() }).execute()).toBe(
      'failed',
    );
    const turns = valueOf(await new GetChat(world).execute({ token }));
    expect(turns.at(-1)?.status).toBe('failed');
  });

  it('refuses a blank message, more than 20 turns in a chat, and more than 60 an hour from one visitor', async () => {
    const world = marketingWorld();
    const { token } = await chatting(world);
    expect(await new SendChatMessage(world).execute({ token, message: ' ', visitor: 'x' })).toEqual(
      { ok: false, error: { field: 'message', code: 'required' } },
    );
    for (let i = 0; i < 20; i += 1) {
      valueOf(
        await new SendChatMessage(world).execute({ token, message: `m${String(i)}`, visitor: 'x' }),
      );
    }
    expect(
      await new SendChatMessage(world).execute({ token, message: 'one more', visitor: 'x' }),
    ).toEqual({ ok: false, error: { code: 'rate_limited' } });

    const busy = marketingWorld();
    for (let chat = 0; chat < 3; chat += 1) {
      const session = await chatting(busy, '198.51.100.1');
      for (let i = 0; i < 20; i += 1) {
        await new SendChatMessage(busy).execute({
          token: session.token,
          message: 'hi',
          visitor: '198.51.100.1',
        });
      }
    }
    const fourth = await chatting(busy, '198.51.100.1');
    expect(
      await new SendChatMessage(busy).execute({
        token: fourth.token,
        message: 'hi',
        visitor: '198.51.100.1',
      }),
    ).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });

  it('deletes chats after 30 days', async () => {
    const world = marketingWorld();
    const { token } = await chatting(world);
    advanceDays(world, 31);
    expect(await new SweepOldChats(world).execute()).toBe(1);
    expect(await new GetChat(world).execute({ token })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('leads', () => {
  const input = {
    name: 'Pat Principal',
    email: 'pat@lincoln.edu',
    organization: 'Lincoln Middle',
    role: 'principal',
    phone: null,
    interest: 'demo',
    source: 'contact' as const,
    message: 'We would like a demo for 30 teachers.',
    locale: 'en',
    page: '/en/contact',
  };

  it('keeps a lead and emails the team only about high-priority ones', async () => {
    const world = marketingWorld();
    const high = valueOf(await new CaptureLead(world).execute(input));
    expect(high.score).toBe('high');
    expect(world.mailer.outbox.map((m) => m.to)).toEqual(['team@teacherhubpro.com']);
    expect(world.mailer.outbox[0]?.text).toContain('pat@lincoln.edu');

    const low = valueOf(
      await new CaptureLead(world).execute({
        ...input,
        email: 'curious@x.com',
        role: 'other',
        interest: 'other',
      }),
    );
    expect(low.score).toBe('medium');
    expect(world.mailer.outbox).toHaveLength(1);
  });

  it('sends no email when no team address is set, and checks the details', async () => {
    const world = marketingWorld(null);
    valueOf(await new CaptureLead(world).execute(input));
    expect(world.mailer.outbox).toEqual([]);
    expect(await new CaptureLead(world).execute({ ...input, email: 'nope' })).toMatchObject({
      ok: false,
      error: { field: 'email' },
    });
  });

  it('lists leads with counts and changes their status, for super admins only', async () => {
    const world = marketingWorld(null);
    const lead = valueOf(await new CaptureLead(world).execute(input));
    const listed = valueOf(await new ListLeads(world).execute({ actor: superAdmin, query: {} }));
    expect(listed.leads.map((l) => l.id)).toEqual([lead.id]);
    expect(listed.counts).toEqual({ high: 1, medium: 0, low: 0 });

    valueOf(
      await new UpdateLeadStatus(world).execute({
        actor: superAdmin,
        leadId: lead.id,
        status: 'contacted',
      }),
    );
    expect((await world.leads.findById(lead.id))?.status).toBe('contacted');

    const refused = { ok: false, error: { code: 'forbidden' } };
    expect(await new ListLeads(world).execute({ actor: teacher, query: {} })).toEqual(refused);
    expect(
      await new UpdateLeadStatus(world).execute({
        actor: teacher,
        leadId: lead.id,
        status: 'closed',
      }),
    ).toEqual(refused);
    expect(
      await new UpdateLeadStatus(world).execute({
        actor: superAdmin,
        leadId: 'nope' as LeadId,
        status: 'closed',
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});
