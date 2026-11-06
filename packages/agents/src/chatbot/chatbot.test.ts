import { describe, expect, it } from 'vitest';
import { chatFacts } from '@thp/domain';
import type { ChatbotRequest } from '@thp/ports';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { scoreChat } from './chatbot-scorecard.ts';
import {
  ChatbotAgent,
  asksIfAi,
  allowedAmounts,
  chatbotSystemPrompt,
  inventedAmounts,
} from './chatbot.ts';

const request = (message: string, overrides: Partial<ChatbotRequest> = {}): ChatbotRequest => ({
  facts: chatFacts(),
  language: 'en',
  role: 'teacher',
  interest: 'pricing',
  history: [{ from: 'assistant', text: 'Hi! I am Ed.' }],
  message,
  ...overrides,
});

describe('ChatbotAgent', () => {
  it('sends the product facts first, then the visitor’s words, never contact details', async () => {
    const llm = new FakeLlmClient().replyWith('The Individual monthly plan is $9.99 a month.');
    await new ChatbotAgent(llm).reply(request('How much is it?'));

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(chatbotSystemPrompt);
    expect(sent?.system).toMatch(/AI assistant/u);
    expect(sent?.messages[0]?.stablePrefix).toContain('"price":9.99');
    expect(prompt).toContain('Visitor role: teacher');
    expect(prompt).toContain('Assistant: Hi! I am Ed.');
    expect(prompt.trimEnd().endsWith('Visitor: How much is it?')).toBe(true);
  });

  it('returns a grounded reply', async () => {
    const llm = new FakeLlmClient().replyWith(
      '  The School plan is $6 per teacher per month, billed yearly, from 10 teachers ($720 a year).  ',
    );
    expect(unwrap(await new ChatbotAgent(llm).reply(request('School price?')))).toBe(
      'The School plan is $6 per teacher per month, billed yearly, from 10 teachers ($720 a year).',
    );
  });

  it('asks again for an invented price, a plan that does not exist, or hiding that it is an AI', async () => {
    const llm = new FakeLlmClient()
      .replyWith('Our plan is $15 a month.')
      .replyWith('The Premium plan has everything.');
    expect(await new ChatbotAgent(llm).reply(request('Price?'))).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toMatch(/\$15/u);

    const hiding = new FakeLlmClient()
      .replyWith('I am Ed, a member of the team.')
      .replyWith('I am Ed, an AI assistant for TeacherHubPro.');
    expect(unwrap(await new ChatbotAgent(hiding).reply(request('Are you a real person?')))).toMatch(
      /AI assistant/u,
    );
    expect(hiding.requests[1]?.messages[2]?.content).toMatch(/AI/u);
  });

  it('reports an unavailable model', async () => {
    const down = new FakeLlmClient().failWith('unavailable');
    expect(await new ChatbotAgent(down).reply(request('Hi'))).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });
});

describe('the grounding checks', () => {
  it('allows only catalog prices and the yearly totals at the minimum seats', () => {
    expect(allowedAmounts(chatFacts())).toEqual(
      expect.arrayContaining([9.99, 79, 6, 4, 720, 4800]),
    );
    expect(
      inventedAmounts('Only $9.99, or $79 a year; $6 or $4 per teacher.', chatFacts()),
    ).toEqual([]);
    expect(inventedAmounts('It is $12.50 or US$ 1,000.', chatFacts())).toEqual([
      '$12.50',
      '$1,000',
    ]);
  });

  it('knows when the visitor asks whether it is a bot, in English and Spanish', () => {
    for (const question of [
      'Are you a bot?',
      'is this an AI',
      'Am I talking to a real person?',
      '¿Eres un robot?',
      '¿Hablo con una persona real?',
      '¿Eres una IA?',
    ]) {
      expect(asksIfAi(question)).toBe(true);
    }
    expect(asksIfAi('How much is the school plan?')).toBe(false);
    expect(asksIfAi('Is the price per person?')).toBe(false);
  });
});

describe('scoreChat', () => {
  it('scores a grounded, honest, short reply in the right language full marks', () => {
    expect(
      scoreChat(
        { asksIfAi: true },
        'Sí, soy Ed, un asistente de IA de TeacherHubPro. ¿Qué te gustaría saber de los planes?',
        request('¿Eres un robot?', { language: 'es' }),
      ),
    ).toEqual({ structure: 1, grounded: 1, honest: 1, language: 1, brief: 1 });
  });

  it('scores a missing, invented or dishonest reply lower', () => {
    expect(scoreChat({ asksIfAi: false }, null, request('Hi'))).toEqual({
      structure: 0,
      grounded: 0,
      honest: 0,
      language: 0,
      brief: 0,
    });
    expect(
      scoreChat(
        { asksIfAi: true },
        `I am a person. It costs $99. ${'x'.repeat(700)}`,
        request('Bot?'),
      ),
    ).toMatchObject({ grounded: 0, honest: 0, brief: 0 });
  });
});
