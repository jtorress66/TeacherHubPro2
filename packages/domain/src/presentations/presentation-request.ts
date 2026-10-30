import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';
import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import { presentationThemes, type PresentationTheme, type SlideInput } from './presentation.ts';

export const slideCountRange = { min: 3, max: 12, default: 6 } as const;

/** What a teacher asks the AI to make slides about. It holds no class or student data. */
export interface PresentationRequest {
  readonly topic: string;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly slideCount: number;
  readonly theme: PresentationTheme;
  readonly language: Language;
}

export interface PresentationRequestInput {
  readonly topic: string;
  readonly subject: string;
  readonly grade: string;
  readonly slideCount?: number;
  readonly theme?: string;
  readonly language: string;
}

/** What the AI drafts: a title and the slides. The teacher edits and saves it. */
export interface PresentationDraft {
  readonly title: string;
  readonly slides: readonly SlideInput[];
}

export function createPresentationRequest(
  input: PresentationRequestInput,
): Result<PresentationRequest, ValidationError> {
  const topic = requiredText('topic', input.topic);
  if (!topic.ok) return topic;
  const subject = input.subject;
  if (!(assistantSubjects as readonly string[]).includes(subject)) {
    return invalid('subject', 'not_allowed');
  }
  if (!isGradeLevel(input.grade)) return invalid('grade', 'not_allowed');
  const slideCount = input.slideCount ?? slideCountRange.default;
  if (
    !Number.isInteger(slideCount) ||
    slideCount < slideCountRange.min ||
    slideCount > slideCountRange.max
  ) {
    return invalid('slideCount', 'out_of_range');
  }
  const theme = input.theme ?? presentationThemes[0];
  if (!(presentationThemes as readonly string[]).includes(theme)) {
    return invalid('theme', 'not_allowed');
  }
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  return ok({
    topic: topic.value,
    subject: subject as AssistantSubject,
    grade: input.grade,
    slideCount,
    theme: theme as PresentationTheme,
    language: input.language,
  });
}
