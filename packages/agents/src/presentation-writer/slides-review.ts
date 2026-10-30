import {
  createPresentation,
  err,
  isSingleEmoji,
  maxBullets,
  ok,
  type PresentationDraft,
  type PresentationId,
  type PresentationRequest,
  type Result,
  type SchoolId,
  type SlideInput,
  type UserId,
} from '@thp/domain';
import type { LlmResponse } from '@thp/ports';
import { objects, parseJsonObject, text, texts, type Json } from '../drafting/json-reply.ts';
import { ruleBroken } from '../drafting/rule-broken.ts';

/** Small slips (a word instead of an emoji, too many bullets) are fixed rather than retried. */
function slideFrom(json: Json): SlideInput {
  const emoji = text(json.emoji) ?? '';
  return {
    layout: typeof json.layout === 'string' ? json.layout : '',
    title: text(json.title),
    subtitle: text(json.subtitle),
    content: text(json.content),
    emoji: isSingleEmoji(emoji) ? emoji : '',
    bullets: texts(json.bullets).slice(0, maxBullets),
  };
}

/** The slides in a reply, or what is wrong with them in plain words. */
export function reviewSlides(
  request: PresentationRequest,
  reply: LlmResponse,
): Result<PresentationDraft, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; keep the slides shorter.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const slides = objects(json.slides).map(slideFrom);
  const count = String(request.slideCount);
  if (slides.length !== request.slideCount) {
    return err(
      `Return exactly ${count} slides in "slides" (you returned ${String(slides.length)}).`,
    );
  }
  if (slides[0]?.layout !== 'title') return err('The first slide must use the "title" layout.');
  const title = text(json.title) ?? request.topic;
  const checked = createPresentation({
    id: 'draft' as PresentationId,
    schoolId: 'draft' as SchoolId,
    teacherId: 'draft' as UserId,
    name: title,
    slides,
    now: new Date(0),
  });
  return checked.ok ? ok({ title, slides }) : err(ruleBroken(checked.error));
}
