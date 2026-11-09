import { describe, expect, it } from 'vitest';
import { createGameRequest, type GameContent } from '@thp/domain';
import { sampleGameContent, unwrap } from '@thp/testing';
import { scoreGame } from './game-scorecard.ts';

const request = unwrap(
  createGameRequest({
    kind: 'pairs',
    subject: 'science',
    grade: '4',
    topic: 'Space',
    language: 'en',
    count: 6,
  }),
);

describe('scoreGame', () => {
  it('gives full marks to playable content of the right count and language', () => {
    expect(scoreGame(request, sampleGameContent.pairs)).toEqual({
      structure: 1,
      count: 1,
      language: 1,
      playable: 1,
    });
  });

  it('scores zero when there is no content', () => {
    expect(scoreGame(request, null)).toEqual({ structure: 0, count: 0, language: 0, playable: 0 });
  });

  it('judges language from the words that show it, not from single names and numbers', () => {
    const spanish: GameContent = {
      kind: 'questions',
      items: [
        { prompt: '¿Qué fracción es mayor?', options: ['1/2', '1/3', '1/4'], answer: 0 },
        { prompt: '¿Cuál es el denominador de 3/4?', options: ['3', '4', '7'], answer: 1 },
      ],
    };
    const portuguese: GameContent = {
      kind: 'groups',
      items: [
        { name: 'Vertebrados', members: ['Gato', 'Cão', 'Peixe'] },
        { name: 'Invertebrados', members: ['Polvo', 'Minhoca', 'Abelha'] },
      ],
    };
    expect(scoreGame({ ...request, language: 'es' }, spanish).language).toBe(1);
    expect(scoreGame({ ...request, language: 'pt' }, portuguese).language).toBe(1);
    expect(scoreGame({ ...request, language: 'es' }, sampleGameContent.questions).language).toBe(0);
  });

  it('marks the wrong count, the wrong language and terms too long for the grids', () => {
    const long: GameContent = {
      kind: 'pairs',
      items: [
        ...sampleGameContent.pairs.items.slice(0, 4),
        { term: 'Photosynthesis', definition: 'How plants make food from the light of the sun' },
      ],
    };
    const scores = scoreGame({ ...request, language: 'es' }, long);
    expect(scores.count).toBe(0);
    expect(scores.language).toBe(0);
    expect(scores.playable).toBeCloseTo(6 / 7);
  });
});
