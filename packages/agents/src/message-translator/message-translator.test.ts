import { describe, expect, it } from 'vitest';
import type { TranslationRequest } from '@thp/ports';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { MessageTranslator, translatorSystemPrompt } from './message-translator.ts';

const request: TranslationRequest = {
  from: 'en',
  to: 'es',
  email: {
    subject: 'This week in History 7',
    body: 'Dear families,\n\nHere is what we will learn this week:\n\n• Monday: The causes of the war\n• Tuesday: The first battles\n\nBest regards,\nMs. Rivera',
  },
};

const spanish = {
  subject: 'Esta semana en Historia 7',
  body: 'Estimadas familias:\n\nEsto es lo que aprenderemos esta semana:\n\n• Lunes: Las causas de la guerra\n• Martes: Las primeras batallas\n\nSaludos cordiales,\nSra. Rivera',
};
const reply = (email: { subject: string; body: string }) => JSON.stringify(email);

describe('MessageTranslator', () => {
  it('sends the email and both languages, with a fixed system prompt', async () => {
    const llm = new FakeLlmClient().replyWith(reply(spanish));
    await new MessageTranslator(llm).translate(request);

    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(translatorSystemPrompt);
    expect(sent?.system).toMatch(/never add/i);
    expect(prompt).toContain('from English into Spanish (español)');
    expect(prompt).toContain('• Monday: The causes of the war');
    expect(sent?.messages[0]?.stablePrefix).toBeDefined();
    expect(sent?.messages[0]?.stablePrefix).not.toContain('Rivera');
  });

  it('returns the translated subject and body', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply(spanish)}\n\`\`\``);
    expect(unwrap(await new MessageTranslator(llm).translate(request))).toEqual(spanish);
  });

  it('asks again when a bullet is lost, or the reply is in the wrong language', async () => {
    const lost = {
      ...spanish,
      body: spanish.body.replace('\n• Martes: Las primeras batallas', ''),
    };
    const english = { subject: 'This week', body: request.email.body };
    const llm = new FakeLlmClient().replyWith(reply(lost)).replyWith(reply(english));
    expect(await new MessageTranslator(llm).translate(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toMatch(/2 bullet/);
  });

  it('asks again after a cut-off, empty or non-JSON reply, and reports an unavailable model', async () => {
    const cut = new FakeLlmClient()
      .replyWith(reply(spanish), 'max_tokens')
      .replyWith(reply(spanish));
    expect(unwrap(await new MessageTranslator(cut).translate(request))).toEqual(spanish);
    expect(cut.requests[1]?.messages[2]?.content).toMatch(/cut off/);

    const empty = new FakeLlmClient()
      .replyWith(reply({ subject: '', body: spanish.body }))
      .replyWith('Aquí está.');
    expect((await new MessageTranslator(empty).translate(request)).ok).toBe(false);

    const down = new FakeLlmClient().failWith('unavailable');
    expect(await new MessageTranslator(down).translate(request)).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });

  it('accepts Chinese, which has no spaces between words', async () => {
    const llm = new FakeLlmClient().replyWith(
      reply({
        subject: '历史7班本周内容',
        body: '各位家长：\n\n本周我们将学习：\n\n• 星期一：战争的起因\n• 星期二：最初的战役\n\n此致\nRivera 老师',
      }),
    );
    expect((await new MessageTranslator(llm).translate({ ...request, to: 'zh' })).ok).toBe(true);
  });
});
