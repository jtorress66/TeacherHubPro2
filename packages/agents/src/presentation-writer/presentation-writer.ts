import {
  maxBullets,
  slideLayouts,
  type PresentationDraft,
  type PresentationRequest,
  type Result,
} from '@thp/domain';
import type { DraftError, LlmClient, PresentationDrafter } from '@thp/ports';
import { draftWithReview } from '../drafting/draft-with-review.ts';
import { languageNames } from '../drafting/language.ts';
import { subjectNames } from '../drafting/subject-names.ts';
import { reviewSlides } from './slides-review.ts';

const maxTokens = 16000;

export const slidesSystemPrompt = `You design fun, clear classroom presentations for students.
The teacher reviews and edits every slide before presenting it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Write every text value in the language the teacher asks for.
- Use simple words that fit the grade, one idea per slide, and short bullets.
- Never invent statistics, dates, quotes attributed to real people, or facts about students.`;

const shape = (count: number) => `{
  "title": string (the presentation's title, at most 120 characters),
  "slides": [exactly ${String(count)} objects: {
    "layout": one of ${slideLayouts.join(', ')},
    "title": string (at most 200 characters),
    "subtitle": string (optional, at most 200 characters),
    "content": string (optional, at most 2000 characters),
    "bullets": [string] (at most ${String(maxBullets)}, each at most 200 characters),
    "emoji": one emoji that fits the slide
  }]
}`;

function prompt(request: PresentationRequest): string {
  return [
    `Create a presentation of exactly ${String(request.slideCount)} slides.`,
    [
      `Write in ${languageNames[request.language]}.`,
      `Subject: ${subjectNames[request.subject]}`,
      `Grade: ${request.grade === 'K' ? 'Kindergarten' : request.grade}`,
      `Topic: ${request.topic}`,
    ].join('\n'),
    [
      'The first slide uses the "title" layout. Then teach the topic step by step,',
      'use "two_column" for comparisons and "quote" for one key idea to remember,',
      'and end with a slide that checks understanding (questions or a short activity).',
    ].join('\n'),
    `Reply with JSON in this shape:\n${shape(request.slideCount)}`,
  ].join('\n\n');
}

/** Drafts slides for a topic. It only drafts: the teacher edits and saves the presentation. */
export class PresentationWriter implements PresentationDrafter {
  constructor(private readonly llm: LlmClient) {}

  draft(request: PresentationRequest): Promise<Result<PresentationDraft, DraftError>> {
    return draftWithReview(this.llm, {
      system: slidesSystemPrompt,
      prompt: prompt(request),
      maxTokens,
      review: (reply) => reviewSlides(request, reply),
      retry: (problem) =>
        `That reply could not be used: ${problem} Reply again with only the corrected JSON object.`,
    });
  }
}
