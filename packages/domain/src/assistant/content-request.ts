import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import {
  isGradeLevel,
  standardSubjects,
  type GradeLevel,
  type StandardSubject,
} from '../standards/common-core.ts';
import {
  draftDifficulties,
  maxInstructionsLength,
  type DraftDifficulty,
} from '../lesson-plans/plan-draft.ts';

/** What the AI assistant can write. A new type adds an entry here and a format in the agent. */
export const contentTypes = ['lesson_plan', 'quiz', 'summary', 'activities', 'worksheet'] as const;
export type ContentType = (typeof contentTypes)[number];

/** Common Core subjects first (the assistant lists their codes), then the others. */
export const assistantSubjects = [
  ...standardSubjects,
  'spanish',
  'english_language',
  'art',
  'music',
  'physical_education',
  'technology',
  'other',
] as const;
export type AssistantSubject = (typeof assistantSubjects)[number];

const typeOptions: Readonly<Record<ContentType, { duration: boolean; questions: boolean }>> = {
  lesson_plan: { duration: true, questions: false },
  quiz: { duration: false, questions: true },
  summary: { duration: false, questions: false },
  activities: { duration: true, questions: false },
  worksheet: { duration: false, questions: false },
};

export const questionCountRange = { min: 1, max: 30, default: 10 } as const;
export const contentMinutesRange = { min: 10, max: 180, default: 45 } as const;

/** What a teacher asks the assistant for. It holds no class or student data. */
export interface ContentRequest {
  readonly type: ContentType;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly topic: string;
  readonly difficulty: DraftDifficulty;
  /** Only for types with a duration (lesson plans, activities). */
  readonly durationMinutes: number | null;
  /** Only for quizzes. */
  readonly questionCount: number | null;
  readonly language: Language;
  readonly instructions: string | null;
}

export interface ContentRequestInput {
  readonly type: string;
  readonly subject: string;
  readonly grade: string;
  readonly topic: string;
  readonly difficulty?: string;
  readonly durationMinutes?: number;
  readonly questionCount?: number;
  readonly language: string;
  readonly instructions?: string | null;
}

interface Range {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

const isContentType = (value: string): value is ContentType => Object.hasOwn(typeOptions, value);
const isSubject = (value: string): value is AssistantSubject =>
  (assistantSubjects as readonly string[]).includes(value);
const isDifficulty = (value: string): value is DraftDifficulty =>
  (draftDifficulties as readonly string[]).includes(value);

/** A number option the type uses (its default when missing), or null when it does not. */
function option(
  field: string,
  used: boolean,
  value: number | undefined,
  range: Range,
): Result<number | null, ValidationError> {
  if (!used) return ok(null);
  const chosen = value ?? range.default;
  return Number.isInteger(chosen) && chosen >= range.min && chosen <= range.max
    ? ok(chosen)
    : invalid(field, 'out_of_range');
}

export function createContentRequest(
  input: ContentRequestInput,
): Result<ContentRequest, ValidationError> {
  if (!isContentType(input.type)) return invalid('type', 'not_allowed');
  if (!isSubject(input.subject)) return invalid('subject', 'not_allowed');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'not_allowed');
  const topic = requiredText('topic', input.topic);
  if (!topic.ok) return topic;
  const difficulty = input.difficulty ?? 'medium';
  if (!isDifficulty(difficulty)) return invalid('difficulty', 'not_allowed');
  const options = typeOptions[input.type];
  const durationMinutes = option(
    'durationMinutes',
    options.duration,
    input.durationMinutes,
    contentMinutesRange,
  );
  if (!durationMinutes.ok) return durationMinutes;
  const questionCount = option(
    'questionCount',
    options.questions,
    input.questionCount,
    questionCountRange,
  );
  if (!questionCount.ok) return questionCount;
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  const instructions = optionalText('instructions', input.instructions, maxInstructionsLength);
  if (!instructions.ok) return instructions;
  return ok({
    type: input.type,
    subject: input.subject,
    grade: input.grade,
    topic: topic.value,
    difficulty,
    durationMinutes: durationMinutes.value,
    questionCount: questionCount.value,
    language: input.language,
    instructions: instructions.value,
  });
}

/** The Common Core subject whose codes the assistant may cite, or null for other subjects. */
export const standardSubjectOf = (request: ContentRequest): StandardSubject | null =>
  (standardSubjects as readonly string[]).includes(request.subject)
    ? (request.subject as StandardSubject)
    : null;

export const usesStandards = (request: ContentRequest): boolean =>
  standardSubjectOf(request) !== null;
