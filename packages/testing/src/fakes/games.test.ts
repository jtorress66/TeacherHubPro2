import { createGameRequest } from '@thp/domain';
import { describe, expect, it } from 'vitest';
import { seedSourceContract } from '../contracts/games.contract.ts';
import { sampleGameContent } from '../game-content.ts';
import { unwrap } from '../unwrap.ts';
import { FakeGameWriter, SequentialSeedSource } from './games.ts';

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
