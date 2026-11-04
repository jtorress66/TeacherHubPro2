import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';

/** 1 rebuilds foundations, 3 is on grade level, 5 stretches past it. */
export const learningLevels = { min: 1, onGrade: 3, max: 5 } as const;

export const lessonCountRange = { min: 3, max: 8, default: 5 } as const;

/** The most objectives of each kind sent to the writer. */
const maxFocus = 8;
const maxObjectiveLength = 300;

/**
 * What the path writer is asked for. It holds no student data: only the subject, grade, language,
 * level and the objectives the student needs to review or has mastered.
 */
export interface PathRequest {
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly language: Language;
  readonly level: number;
  readonly lessonCount: number;
  /** What to teach, or null for the writer to choose what comes next. */
  readonly topic: string | null;
  readonly review: readonly string[];
  readonly mastered: readonly string[];
}

export interface PathRequestInput {
  readonly subject: string;
  readonly grade: string;
  readonly language: string;
  readonly level: number;
  readonly lessonCount?: number;
  readonly topic?: string | null;
  readonly review?: readonly string[];
  readonly mastered?: readonly string[];
}

export const isSubject = (value: string): value is AssistantSubject =>
  (assistantSubjects as readonly string[]).includes(value);

export const isLearningLevel = (value: number): boolean =>
  Number.isInteger(value) && value >= learningLevels.min && value <= learningLevels.max;

const focus = (items: readonly string[] | undefined): string[] =>
  (items ?? [])
    .map((item) => item.trim().slice(0, maxObjectiveLength))
    .filter((item) => item !== '')
    .slice(0, maxFocus);

export function createPathRequest(input: PathRequestInput): Result<PathRequest, ValidationError> {
  if (!isSubject(input.subject)) return invalid('subject', 'invalid_format');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'invalid_format');
  if (!isLanguage(input.language)) return invalid('language', 'invalid_format');
  if (!isLearningLevel(input.level)) return invalid('level', 'out_of_range');
  const lessonCount = input.lessonCount ?? lessonCountRange.default;
  if (
    !Number.isInteger(lessonCount) ||
    lessonCount < lessonCountRange.min ||
    lessonCount > lessonCountRange.max
  ) {
    return invalid('lessonCount', 'out_of_range');
  }
  const topic = optionalText('topic', input.topic);
  if (!topic.ok) return topic;
  return ok({
    subject: input.subject,
    grade: input.grade,
    language: input.language,
    level: input.level,
    lessonCount,
    topic: topic.value,
    review: focus(input.review),
    mastered: focus(input.mastered),
  });
}
