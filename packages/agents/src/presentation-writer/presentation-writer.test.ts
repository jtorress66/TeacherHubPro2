import { describe, expect, it } from 'vitest';
import { createPresentationRequest, type PresentationRequest } from '@thp/domain';
import { FakeLlmClient, unwrap } from '@thp/testing';
import { PresentationWriter } from './presentation-writer.ts';
import { reviewSlides } from './slides-review.ts';

const request = (overrides: Partial<Parameters<typeof createPresentationRequest>[0]> = {}) =>
  unwrap(
    createPresentationRequest({
      topic: 'Volcanoes',
      subject: 'science',
      grade: '5',
      slideCount: 3,
      language: 'es',
      ...overrides,
    }),
  );

const slides = (count = 3) => [
  { layout: 'title', title: 'Volcanes', subtitle: 'Montañas de fuego', emoji: '🌋' },
  ...Array.from({ length: count - 1 }, (_, i) => ({
    layout: 'content',
    title: `Parte ${String(i + 1)}`,
    content: 'El magma sube.',
    bullets: ['Magma', 'Presión'],
    emoji: '🔥',
  })),
];
const reply = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ title: 'Volcanes', slides: slides(), ...overrides });

const review = (text: string, req: PresentationRequest = request()) =>
  reviewSlides(req, { text, stopReason: 'end' });

describe('PresentationWriter', () => {
  it('asks for the exact number of slides in the teacher’s language, with only the request', async () => {
    const llm = new FakeLlmClient().replyWith(reply());
    await new PresentationWriter(llm).draft(request());

    const prompt = llm.requests[0]?.messages[0]?.content ?? '';
    expect(prompt).toContain('exactly 3 slides');
    expect(prompt).toContain('Write in Spanish (español).');
    expect(prompt).toContain('Subject: Science');
    expect(prompt).toContain('Grade: 5');
    expect(prompt).toContain('Topic: Volcanoes');
    expect(prompt).toContain('title, content, image_left, image_right, two_column, quote');
  });

  it('returns the drafted slides', async () => {
    const llm = new FakeLlmClient().replyWith(`\`\`\`json\n${reply()}\n\`\`\``);
    const draft = unwrap(await new PresentationWriter(llm).draft(request()));

    expect(draft.title).toBe('Volcanes');
    expect(draft.slides).toHaveLength(3);
    expect(draft.slides[0]).toMatchObject({ layout: 'title', emoji: '🌋' });
  });

  it('retries with the reason, then gives up with invalid_output', async () => {
    const short = reply({ slides: slides(2) });
    const llm = new FakeLlmClient().replyWith(short).replyWith(short);
    expect(await new PresentationWriter(llm).draft(request())).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
    expect(llm.requests[1]?.messages[2]?.content).toContain('exactly 3 slides');
  });
});

describe('reviewSlides', () => {
  it('blanks an emoji that is not one emoji and trims extra bullets, rather than failing', () => {
    const odd = slides();
    odd[1] = {
      ...odd[1],
      emoji: 'fire',
      bullets: Array.from({ length: 10 }, (_, i) => `b${String(i)}`),
    } as (typeof odd)[number];
    const draft = review(reply({ slides: odd }));

    expect(draft.ok && draft.value.slides[1]).toMatchObject({ emoji: '' });
    expect(draft.ok && draft.value.slides[1]?.bullets).toHaveLength(8);
  });

  it('falls back to the topic when the reply has no title', () => {
    const draft = review(reply({ title: '' }));
    expect(draft.ok && draft.value.title).toBe('Volcanoes');
  });

  it.each([
    ['a cut-off reply', null, /cut off/],
    ['no JSON', 'Here are your slides', /not one JSON object/],
    ['no slides array', JSON.stringify({ title: 'x' }), /exactly 3 slides/],
    ['the wrong count', reply({ slides: slides(4) }), /exactly 3 slides/],
    [
      'a first slide that is not a title slide',
      reply({ slides: [...slides()].reverse() }),
      /first slide/,
    ],
    [
      'an unknown layout',
      reply({ slides: [slides()[0], { layout: 'video', title: 'x' }, slides()[1]] }),
      /"slides.1.layout"/,
    ],
    [
      'an over-long title',
      reply({ slides: [slides()[0], { layout: 'content', title: 'x'.repeat(300) }, slides()[1]] }),
      /"slides.1.title" is too long/,
    ],
  ])('rejects %s', (_, text, problem) => {
    const result =
      text === null
        ? reviewSlides(request(), { text: reply(), stopReason: 'max_tokens' })
        : review(text);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(problem);
  });
});
