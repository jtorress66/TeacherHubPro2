import type { PresentationDraft, PresentationRequest } from '@thp/domain';
import { detectLanguage } from '../drafting/language.ts';

export const presentationMetrics = ['structure', 'language', 'slideCount', 'titles'] as const;
export type PresentationMetric = (typeof presentationMetrics)[number];
export type PresentationScores = Readonly<Record<PresentationMetric, number>>;

const slideText = (draft: PresentationDraft): string =>
  draft.slides
    .flatMap((slide) => [slide.title, slide.subtitle, slide.content, ...(slide.bullets ?? [])])
    .filter(Boolean)
    .join('\n');

/** Scores one eval case from the request and the writer's draft. */
export function scorePresentation(
  request: PresentationRequest,
  draft: PresentationDraft | null,
): PresentationScores {
  if (draft === null) return { structure: 0, language: 0, slideCount: 0, titles: 0 };
  return {
    structure: 1,
    language: detectLanguage(slideText(draft)) === request.language ? 1 : 0,
    slideCount: draft.slides.length === request.slideCount ? 1 : 0,
    titles: draft.slides.every((slide) => Boolean(slide.title?.trim())) ? 1 : 0,
  };
}
