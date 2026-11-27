import { describe, expect, it } from 'vitest';
import type { ExplanationRequest } from '@thp/ports';
import { FakeLlmClient, unwrap } from '@thp/testing';
import {
  ExplanationWriter,
  explanationSystemPrompt,
  reviewExplanations,
} from './explanation-writer.ts';

const request: ExplanationRequest = {
  language: 'es',
  items: [
    {
      index: 0,
      question: '¿Cuál es el planeta más grande?',
      options: ['Marte', 'Júpiter'],
      answer: 'Júpiter',
    },
    { index: 3, question: 'La Luna es un planeta', answer: 'false' },
  ],
};

const good = JSON.stringify({
  explanations: [
    'Júpiter tiene más masa que todos los otros planetas juntos.',
    'La Luna gira alrededor de la Tierra, por eso es un satélite y no un planeta.',
  ],
});

const reply = (text: string, stopReason: 'end' | 'max_tokens' = 'end') => ({ text, stopReason });

describe('ExplanationWriter', () => {
  it('sends each item’s question, options and right answer in the game’s language, and nothing else', async () => {
    const llm = new FakeLlmClient().replyWith(good);
    const explanations = unwrap(await new ExplanationWriter(llm).explain(request));

    expect(explanations).toEqual([
      'Júpiter tiene más masa que todos los otros planetas juntos.',
      'La Luna gira alrededor de la Tierra, por eso es un satélite y no un planeta.',
    ]);
    const [sent] = llm.requests;
    const prompt = sent?.messages[0]?.content ?? '';
    expect(sent?.system).toBe(explanationSystemPrompt);
    expect(prompt).toContain('Write in Spanish (español).');
    expect(prompt).toContain('"question":"¿Cuál es el planeta más grande?"');
    expect(prompt).toContain('"answer":"false"');
    expect(prompt).not.toContain('"index"');
    expect(sent?.messages[0]?.stablePrefix).toBeDefined();
  });

  it('asks again with the problem, then gives up', async () => {
    const llm = new FakeLlmClient().replyWith('{}').replyWith('not json');
    expect(await new ExplanationWriter(llm).explain(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages.at(-1)?.content).toContain('could not be used');
  });
});

describe('reviewExplanations', () => {
  it('needs one explanation per item, in order', () => {
    const one = JSON.stringify({ explanations: ['Júpiter es el más grande de todos.'] });
    expect(reviewExplanations(reply(one), request)).toEqual({
      ok: false,
      error: 'Write exactly 2 explanations, one per item, in the same order; there were 1.',
    });
  });

  it('refuses placeholders, empty or overlong sentences, and a bare repeat of the answer', () => {
    const withSecond = (second: string) =>
      reply(JSON.stringify({ explanations: ['Júpiter es el planeta más grande.', second] }));
    expect(reviewExplanations(withSecond('TODO'), request).ok).toBe(false);
    expect(reviewExplanations(withSecond(''), request).ok).toBe(false);
    expect(reviewExplanations(withSecond('x'.repeat(301)), request).ok).toBe(false);
    expect(reviewExplanations(withSecond('False.'), request)).toEqual({
      ok: false,
      error: 'Explanation 2 only repeats the answer; say why it is right.',
    });
  });

  it('refuses explanations in another language, and a cut-off reply', () => {
    const english = JSON.stringify({
      explanations: [
        'Jupiter is the largest planet of the solar system.',
        'The Moon goes around the Earth, so it is not a planet.',
      ],
    });
    expect(reviewExplanations(reply(english), request)).toEqual({
      ok: false,
      error: 'Write the explanations in Spanish (español).',
    });
    expect(reviewExplanations(reply(good, 'max_tokens'), request).ok).toBe(false);
  });
});
