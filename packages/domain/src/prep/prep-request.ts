import type { ClassId, GradeCategoryId } from '../shared/ids.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { addDays, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { isMonday } from '../lesson-plans/plan-fields.ts';
import {
  isGradeLevel,
  standardSubjects,
  type GradeLevel,
  type StandardSubject,
} from '../standards/common-core.ts';
import { checkEmailTemplate, type EmailTemplate } from './parent-email.ts';

export const maxPrepPromptLength = 500;
export const prepDaysRange = { min: 1, max: 5, default: 5 } as const;
export const prepQuizQuestions = 10;

export interface PrepOptions {
  readonly presentations: boolean;
  readonly worksheets: boolean;
  readonly quiz: boolean;
  readonly parentEmail: boolean;
}

/** What a teacher asks the prep agent for. It holds no student data. */
export interface PrepRequest {
  readonly classId: ClassId;
  readonly prompt: string;
  /** The week's Monday. */
  readonly weekStart: LocalDate;
  readonly subject: StandardSubject;
  readonly grade: GradeLevel;
  readonly days: number;
  readonly options: PrepOptions;
  /** Where the quiz goes in the gradebook; null without a quiz. */
  readonly quizCategoryId: GradeCategoryId | null;
  readonly language: Language;
  readonly emailTemplate: EmailTemplate;
}

export interface PrepRequestInput {
  readonly classId: ClassId;
  readonly prompt: string;
  readonly weekStart: string;
  readonly subject: string;
  readonly grade: string;
  readonly days: number;
  readonly options: PrepOptions;
  readonly quizCategoryId: GradeCategoryId | null;
  readonly language: string;
  readonly emailTemplate: EmailTemplate;
}

const isStandardSubject = (value: string): value is StandardSubject =>
  (standardSubjects as readonly string[]).includes(value);

export function createPrepRequest(input: PrepRequestInput): Result<PrepRequest, ValidationError> {
  const prompt = requiredText('prompt', input.prompt, maxPrepPromptLength);
  if (!prompt.ok) return prompt;
  const weekStart = parseLocalDate('weekStart', input.weekStart);
  if (!weekStart.ok) return weekStart;
  if (!isMonday(weekStart.value)) return invalid('weekStart', 'not_allowed');
  if (!isStandardSubject(input.subject)) return invalid('subject', 'not_allowed');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'not_allowed');
  const { days } = input;
  if (!Number.isInteger(days) || days < prepDaysRange.min || days > prepDaysRange.max) {
    return invalid('days', 'out_of_range');
  }
  if (input.options.quiz && input.quizCategoryId === null) {
    return invalid('quizCategoryId', 'required');
  }
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  const template = checkEmailTemplate(input.emailTemplate);
  if (!template.ok) return template;
  return ok({
    classId: input.classId,
    prompt: prompt.value,
    weekStart: weekStart.value,
    subject: input.subject,
    grade: input.grade,
    days,
    options: { ...input.options },
    quizCategoryId: input.options.quiz ? input.quizCategoryId : null,
    language: input.language,
    emailTemplate: template.value,
  });
}

/** The quiz is due on the week's Friday. */
export const quizDay = (request: PrepRequest): LocalDate => addDays(request.weekStart, 4);
