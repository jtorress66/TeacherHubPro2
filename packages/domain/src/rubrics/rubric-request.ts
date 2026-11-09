import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import { maxInstructionsLength } from '../lesson-plans/plan-draft.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';
import {
  maxRubricTitleLength,
  rubricCriteriaRange,
  rubricLevelRange,
  type RubricCriterion,
  type RubricLevel,
} from './rubric.ts';

/** What a teacher asks the AI to draft a rubric for. It holds no class or student data. */
export interface RubricRequest {
  readonly topic: string;
  readonly subject: AssistantSubject | null;
  readonly grade: GradeLevel | null;
  readonly title: string | null;
  readonly criteriaCount: number;
  readonly levelCount: number;
  readonly language: Language;
  /** Written for English learners (WIDA levels, simple wording). */
  readonly esl: boolean;
  readonly instructions: string | null;
}

export interface RubricRequestInput {
  readonly topic: string;
  readonly subject?: string | null;
  readonly grade?: string | null;
  readonly title?: string | null;
  readonly criteriaCount?: number;
  readonly levelCount?: number;
  readonly language: string;
  readonly esl?: boolean;
  readonly instructions?: string | null;
}

/** What the AI drafts. The teacher edits and saves it as a rubric. */
export interface RubricDraft {
  readonly title: string;
  readonly levels: readonly RubricLevel[];
  readonly criteria: readonly RubricCriterion[];
}

function count(
  field: string,
  value: number | undefined,
  range: { min: number; max: number; default: number },
): Result<number, ValidationError> {
  const chosen = value ?? range.default;
  return Number.isInteger(chosen) && chosen >= range.min && chosen <= range.max
    ? ok(chosen)
    : invalid(field, 'out_of_range');
}

export function createRubricRequest(
  input: RubricRequestInput,
): Result<RubricRequest, ValidationError> {
  const topic = requiredText('topic', input.topic);
  if (!topic.ok) return topic;
  const subject = input.subject?.trim() ?? '';
  if (subject !== '' && !(assistantSubjects as readonly string[]).includes(subject)) {
    return invalid('subject', 'not_allowed');
  }
  const grade = input.grade?.trim() ?? '';
  if (grade !== '' && !isGradeLevel(grade)) return invalid('grade', 'not_allowed');
  const title = optionalText('title', input.title, maxRubricTitleLength);
  if (!title.ok) return title;
  const criteriaCount = count('criteriaCount', input.criteriaCount, rubricCriteriaRange);
  if (!criteriaCount.ok) return criteriaCount;
  const levelCount = count('levelCount', input.levelCount, rubricLevelRange);
  if (!levelCount.ok) return levelCount;
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  const instructions = optionalText('instructions', input.instructions, maxInstructionsLength);
  if (!instructions.ok) return instructions;
  return ok({
    topic: topic.value,
    subject: subject === '' ? null : (subject as AssistantSubject),
    grade: grade === '' ? null : grade,
    title: title.value,
    criteriaCount: criteriaCount.value,
    levelCount: levelCount.value,
    language: input.language,
    esl: input.esl === true,
    instructions: instructions.value,
  });
}
