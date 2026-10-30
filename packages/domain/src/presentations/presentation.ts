import type { PresentationId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';
import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';

/** Slide layouts, as data: the UI maps each to its regions. */
export const slideLayouts = [
  'title',
  'content',
  'image_left',
  'image_right',
  'two_column',
  'quote',
] as const;
export type SlideLayout = (typeof slideLayouts)[number];

export const presentationThemes = [
  'ocean',
  'sunset',
  'forest',
  'galaxy',
  'minimal',
  'blackboard',
  'candy',
  'nature',
] as const;
export type PresentationTheme = (typeof presentationThemes)[number];

export const slideTransitions = ['none', 'fade', 'slide', 'zoom'] as const;
export type SlideTransition = (typeof slideTransitions)[number];

export const maxSlides = 30;
export const maxBullets = 8;
export const maxSlideContentLength = 2000;
export const maxPresentationNameLength = 120;

export interface Slide {
  readonly layout: SlideLayout;
  readonly title: string;
  readonly subtitle: string | null;
  readonly content: string | null;
  /** One emoji, or '' for none. */
  readonly emoji: string;
  readonly bullets: readonly string[];
  readonly transition: SlideTransition;
}

export interface SlideInput {
  readonly layout: string;
  readonly title?: string | null;
  readonly subtitle?: string | null;
  readonly content?: string | null;
  readonly emoji?: string | null;
  readonly bullets?: readonly string[];
  readonly transition?: string;
}

export interface Presentation {
  readonly id: PresentationId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly name: string;
  readonly topic: string | null;
  readonly subject: AssistantSubject | null;
  readonly grade: GradeLevel | null;
  readonly theme: PresentationTheme;
  readonly slides: readonly Slide[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface PresentationDetails {
  readonly name: string;
  readonly topic?: string | null;
  readonly subject?: string | null;
  readonly grade?: string | null;
  readonly theme?: string;
  readonly slides: readonly SlideInput[];
}

export interface PresentationInput extends PresentationDetails {
  readonly id: PresentationId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly now: Date;
}

type Checked<T> = Result<T, ValidationError>;

const oneOf =
  <T extends string>(list: readonly T[]) =>
  (value: string): value is T =>
    (list as readonly string[]).includes(value);

const isLayout = oneOf(slideLayouts);
const isTheme = oneOf(presentationThemes);
const isTransition = oneOf(slideTransitions);
const isSubject = oneOf(assistantSubjects);

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const pictographic = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** One emoji: a single grapheme, possibly made of several code points. */
export const isSingleEmoji = (text: string): boolean =>
  [...graphemes.segment(text)].length === 1 && pictographic.test(text);

/** A single emoji, or blank. */
function emoji(field: string, value: string | null | undefined): Checked<string> {
  const text = value?.trim() ?? '';
  if (text === '') return ok('');
  return isSingleEmoji(text) ? ok(text) : invalid(field, 'invalid_format');
}

function bullets(field: string, values: readonly string[] | undefined): Checked<string[]> {
  const result: string[] = [];
  for (const value of values ?? []) {
    const bullet = optionalText(field, value);
    if (!bullet.ok) return bullet;
    if (bullet.value !== null) result.push(bullet.value);
  }
  return result.length > maxBullets ? invalid(field, 'out_of_range') : ok(result);
}

function slide(field: string, input: SlideInput): Checked<Slide> {
  if (!isLayout(input.layout)) return invalid(`${field}.layout`, 'not_allowed');
  const transition = input.transition ?? 'fade';
  if (!isTransition(transition)) return invalid(`${field}.transition`, 'not_allowed');
  const title = optionalText(`${field}.title`, input.title);
  if (!title.ok) return title;
  const subtitle = optionalText(`${field}.subtitle`, input.subtitle);
  if (!subtitle.ok) return subtitle;
  const content = optionalText(`${field}.content`, input.content, maxSlideContentLength);
  if (!content.ok) return content;
  const picture = emoji(`${field}.emoji`, input.emoji);
  if (!picture.ok) return picture;
  const points = bullets(`${field}.bullets`, input.bullets);
  if (!points.ok) return points;
  return ok({
    layout: input.layout,
    title: title.value ?? '',
    subtitle: subtitle.value,
    content: content.value,
    emoji: picture.value,
    bullets: points.value,
    transition,
  });
}

function slides(inputs: readonly SlideInput[]): Checked<Slide[]> {
  if (inputs.length === 0 || inputs.length > maxSlides) return invalid('slides', 'out_of_range');
  const result: Slide[] = [];
  for (const [index, input] of inputs.entries()) {
    const checked = slide(`slides.${String(index)}`, input);
    if (!checked.ok) return checked;
    result.push(checked.value);
  }
  return ok(result);
}

type CheckedDetails = Pick<
  Presentation,
  'name' | 'topic' | 'subject' | 'grade' | 'theme' | 'slides'
>;

function details(input: PresentationDetails): Checked<CheckedDetails> {
  const name = requiredText('name', input.name, maxPresentationNameLength);
  if (!name.ok) return name;
  const topic = optionalText('topic', input.topic);
  if (!topic.ok) return topic;
  const subject = input.subject ?? null;
  if (subject !== null && !isSubject(subject)) return invalid('subject', 'not_allowed');
  const grade = input.grade ?? null;
  if (grade !== null && !isGradeLevel(grade)) return invalid('grade', 'not_allowed');
  const theme = input.theme ?? presentationThemes[0];
  if (!isTheme(theme)) return invalid('theme', 'not_allowed');
  const checkedSlides = slides(input.slides);
  if (!checkedSlides.ok) return checkedSlides;
  return ok({
    name: name.value,
    topic: topic.value,
    subject,
    grade,
    theme,
    slides: checkedSlides.value,
  });
}

export function createPresentation(input: PresentationInput): Checked<Presentation> {
  const checked = details(input);
  if (!checked.ok) return checked;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    ...checked.value,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function updatePresentation(
  presentation: Presentation,
  changes: PresentationDetails,
  now: Date,
): Checked<Presentation> {
  const checked = details(changes);
  return checked.ok ? ok({ ...presentation, ...checked.value, updatedAt: now }) : checked;
}

/** A list row: everything but the slides, with how many there are. */
export type PresentationSummary = Omit<Presentation, 'slides'> & { readonly slideCount: number };

export const presentationSummary = (presentation: Presentation): PresentationSummary => ({
  id: presentation.id,
  schoolId: presentation.schoolId,
  teacherId: presentation.teacherId,
  name: presentation.name,
  topic: presentation.topic,
  subject: presentation.subject,
  grade: presentation.grade,
  theme: presentation.theme,
  createdAt: presentation.createdAt,
  updatedAt: presentation.updatedAt,
  slideCount: presentation.slides.length,
});

export const blankSlide = (layout: SlideLayout, title = ''): Slide => ({
  layout,
  title,
  subtitle: null,
  content: null,
  emoji: '',
  bullets: [],
  transition: 'fade',
});

const inBounds = (list: readonly unknown[], index: number) =>
  Number.isInteger(index) && index >= 0 && index < list.length;

/** Moves a slide to another position; a move past either end changes nothing. */
export function moveSlide(list: readonly Slide[], from: number, to: number): readonly Slide[] {
  if (!inBounds(list, from) || !inBounds(list, to)) return list;
  const result = [...list];
  const [moved] = result.splice(from, 1);
  if (moved === undefined) return list;
  result.splice(to, 0, moved);
  return result;
}

/** Copies a slide right after itself, unless the deck is full. */
export function duplicateSlide(list: readonly Slide[], index: number): readonly Slide[] {
  const original = list[index];
  if (original === undefined || list.length >= maxSlides) return list;
  return [...list.slice(0, index + 1), original, ...list.slice(index + 1)];
}

/** Removes a slide; a deck always keeps at least one. */
export function removeSlide(list: readonly Slide[], index: number): readonly Slide[] {
  if (!inBounds(list, index) || list.length === 1) return list;
  return list.filter((_, position) => position !== index);
}
