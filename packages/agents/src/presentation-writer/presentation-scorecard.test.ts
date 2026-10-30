import { describe, expect, it } from 'vitest';
import { createPresentationRequest } from '@thp/domain';
import { aPresentationDraft, unwrap } from '@thp/testing';
import { presentationMetrics, scorePresentation } from './presentation-scorecard.ts';

const request = unwrap(
  createPresentationRequest({
    topic: 'Volcanoes',
    subject: 'science',
    grade: '5',
    slideCount: 3,
    language: 'en',
  }),
);

describe('scorePresentation', () => {
  it('scores a full draft in the right language as all ones', () => {
    const draft = aPresentationDraft({
      slides: [
        { layout: 'title', title: 'Volcanoes', subtitle: 'The mountains of fire and the people' },
        { layout: 'content', title: 'How they form', content: 'The magma rises to the top.' },
        { layout: 'quote', title: 'Remember', content: 'Lava is magma with the air.' },
      ],
    });
    expect(scorePresentation(request, draft)).toEqual({
      structure: 1,
      language: 1,
      slideCount: 1,
      titles: 1,
    });
  });

  it('scores a missing draft as failing', () => {
    expect(scorePresentation(request, null)).toEqual({
      structure: 0,
      language: 0,
      slideCount: 0,
      titles: 0,
    });
  });

  it('notices a wrong slide count and untitled slides', () => {
    const draft = aPresentationDraft({
      slides: [
        { layout: 'title', title: 'Volcanoes and the students' },
        { layout: 'content', title: '' },
      ],
    });
    expect(scorePresentation(request, draft)).toMatchObject({ slideCount: 0, titles: 0 });
    expect(presentationMetrics).toEqual(['structure', 'language', 'slideCount', 'titles']);
  });
});
