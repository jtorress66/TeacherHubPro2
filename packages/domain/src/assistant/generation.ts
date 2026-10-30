import type { GenerationId, SchoolId, UserId } from '../shared/ids.ts';
import type { Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { requiredText, type ValidationError } from '../shared/validation.ts';
import { findStandard, type GradeLevel } from '../standards/common-core.ts';
import type { AssistantSubject, ContentRequest, ContentType } from './content-request.ts';

export const maxGenerationLength = 40_000;

/** A piece of content the assistant wrote, kept in the teacher's history until deleted. */
export interface AiGeneration {
  readonly id: GenerationId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly type: ContentType;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly topic: string;
  readonly language: Language;
  /** Markdown. */
  readonly content: string;
  readonly createdAt: Date;
}

export interface GenerationInput {
  readonly id: GenerationId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly request: ContentRequest;
  readonly content: string;
  readonly createdAt: Date;
}

export function createGeneration(input: GenerationInput): Result<AiGeneration, ValidationError> {
  const content = requiredText('content', input.content, maxGenerationLength);
  if (!content.ok) return content;
  const { type, subject, grade, topic, language } = input.request;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    type,
    subject,
    grade,
    topic,
    language,
    content: content.value,
    createdAt: input.createdAt,
  });
}

/** A history row: everything but the content. */
export type GenerationSummary = Omit<AiGeneration, 'content'>;

export const generationSummary = (generation: AiGeneration): GenerationSummary => ({
  id: generation.id,
  schoolId: generation.schoolId,
  teacherId: generation.teacherId,
  type: generation.type,
  subject: generation.subject,
  grade: generation.grade,
  topic: generation.topic,
  language: generation.language,
  createdAt: generation.createdAt,
});

const codePattern = /CCSS\.[A-Za-z0-9.-]*[A-Za-z0-9]/g;

/** Removes any Common Core code that is not in the official list, so none is ever invented. */
export const removeUnknownCodes = (text: string): string =>
  text
    .replace(codePattern, (code) => (findStandard(code) === null ? '' : code))
    .replace(/ {2,}/g, ' ');
