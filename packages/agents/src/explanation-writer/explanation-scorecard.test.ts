import { describe, expect, it } from 'vitest';
import type { ExplanationRequest } from '@thp/ports';
import { scoreExplanations } from './explanation-scorecard.ts';

const request: ExplanationRequest = {
  language: 'en',
  items: [
    { index: 0, question: 'Largest planet?', options: ['Mars', 'Jupiter'], answer: 'Jupiter' },
    { index: 1, question: 'The Moon is a planet', answer: 'false' },
  ],
};

describe('scoreExplanations', () => {
  it('gives full marks to one explanation per item, in the language, that says why', () => {
    expect(
      scoreExplanations(request, [
        'Jupiter is more massive than all the other planets together.',
        'The Moon goes around the Earth, so it is a moon and not a planet.',
      ]),
    ).toEqual({ structure: 1, count: 1, language: 1, explains: 1 });
  });

  it('scores zero when there is no usable reply', () => {
    expect(scoreExplanations(request, null)).toEqual({
      structure: 0,
      count: 0,
      language: 0,
      explains: 0,
    });
  });

  it('marks the wrong count, the wrong language and a bare repeat of the answer', () => {
    const scores = scoreExplanations({ ...request, language: 'es' }, [
      'Jupiter is the biggest planet in our solar system.',
      'False',
      'One too many.',
    ]);
    expect(scores.count).toBe(0);
    expect(scores.language).toBe(0);
    expect(scores.explains).toBe(0.5);
  });
});
