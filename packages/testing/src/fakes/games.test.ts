import { createGameRequest } from '@thp/domain';
import { describe, expect, it } from 'vitest';
import { seedSourceContract } from '../contracts/games.contract.ts';
import { sampleGameContent } from '../game-content.ts';
import { unwrap } from '../unwrap.ts';
import { FakeExplanationWriter, FakeGameWriter, SequentialSeedSource } from './games.ts';

seedSourceContract('SequentialSeedSource', () => new SequentialSeedSource());

describe('FakeGameWriter', () => {
  const request = unwrap(
    createGameRequest({
      kind: 'steps',
      subject: 'science',
      grade: '3',
      topic: 'Water',
      language: 'en',
    }),
  );

  it('writes the sample content for the kind and records the request', async () => {
    const writer = new FakeGameWriter();
    expect(unwrap(await writer.write(request))).toEqual(sampleGameContent.steps);
    expect(writer.requests).toEqual([request]);
  });

  it('can fail like the model would', async () => {
    expect(await new FakeGameWriter('ai_unavailable').write(request)).toEqual({
      ok: false,
      error: { code: 'ai_unavailable' },
    });
  });
});

describe('FakeExplanationWriter', () => {
  const request = {
    language: 'en' as const,
    items: [
      { index: 0, question: 'Largest planet?', answer: 'Jupiter' },
      { index: 2, question: 'The Moon is a planet', answer: 'false' },
    ],
  };

  it('explains each item in order and records the request', async () => {
    const writer = new FakeExplanationWriter();
    expect(unwrap(await writer.explain(request))).toEqual([
      'Why Jupiter answers “Largest planet?”.',
      'Why false answers “The Moon is a planet”.',
    ]);
    expect(writer.requests).toEqual([request]);
  });

  it('can fail like the model would', async () => {
    expect(await new FakeExplanationWriter('invalid_output').explain(request)).toEqual({
      ok: false,
      error: { code: 'invalid_output' },
    });
  });
});
