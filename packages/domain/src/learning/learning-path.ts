import type { AssistantSubject } from '../assistant/content-request.ts';
import { validateContent } from '../games/content.ts';
import { isPlaceholder } from '../games/content.ts';
import type { ClassId, LearningPathId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';
import { isLearningLevel, isSubject, lessonCountRange } from './path-request.ts';

/** One multiple-choice question that checks a lesson; `answer` is the right option's index. */
export interface LessonCheck {
  readonly prompt: string;
  readonly options: readonly string[];
  readonly answer: number;
}

export interface LearningLesson {
  readonly title: string;
  readonly objective: string;
  readonly minutes: number;
  /** The reading: what the student learns before the check. */
  readonly content: string;
  readonly checks: readonly LessonCheck[];
}

export type PathStatus = 'draft' | 'assigned' | 'archived';

/**
 * A personal sequence of lessons for one student in one subject. The AI drafts it; the teacher
 * reviews it and assigns it, and only then does it appear on the student's link.
 */
export interface LearningPath {
  readonly id: LearningPathId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly studentId: StudentId;
  readonly classId: ClassId;
  readonly subject: AssistantSubject;
  readonly grade: GradeLevel;
  readonly language: Language;
  readonly level: number;
  readonly title: string;
  readonly description: string;
  readonly lessons: readonly LearningLesson[];
  readonly status: PathStatus;
  readonly createdAt: Date;
  readonly assignedAt: Date | null;
}

export interface LearningPathInput {
  readonly id: LearningPathId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly studentId: StudentId;
  readonly classId: ClassId;
  readonly subject: string;
  readonly grade: string;
  readonly language: string;
  readonly level: number;
  readonly title: string;
  readonly description: string;
  readonly lessons: readonly LearningLesson[];
  readonly createdAt: Date;
}

export const lessonMinutesRange = { min: 5, max: 60 } as const;
export const checkCountRange = { min: 3, max: 6 } as const;
export const maxLessonContentLength = 4000;
const maxObjectiveLength = 300;
const maxDescriptionLength = 500;

type Checked<T> = Result<T, ValidationError>;

function text(field: string, value: string, maxLength?: number): Checked<string> {
  const checked = requiredText(field, value, maxLength);
  if (!checked.ok) return checked;
  return isPlaceholder(checked.value) ? invalid(field, 'not_allowed') : checked;
}

function checkLesson(field: string, lesson: LearningLesson): Checked<LearningLesson> {
  const title = text(`${field}.title`, lesson.title);
  if (!title.ok) return title;
  const objective = text(`${field}.objective`, lesson.objective, maxObjectiveLength);
  if (!objective.ok) return objective;
  const { minutes } = lesson;
  if (
    !Number.isInteger(minutes) ||
    minutes < lessonMinutesRange.min ||
    minutes > lessonMinutesRange.max
  ) {
    return invalid(`${field}.minutes`, 'out_of_range');
  }
  const content = text(`${field}.content`, lesson.content, maxLessonContentLength);
  if (!content.ok) return content;
  if (lesson.checks.length < checkCountRange.min) return invalid(`${field}.checks`, 'too_short');
  if (lesson.checks.length > checkCountRange.max) return invalid(`${field}.checks`, 'too_long');
  // The checks follow the quiz rules of games: real options, the answer among them.
  const checks = validateContent({ kind: 'questions', items: lesson.checks });
  if (!checks.ok) {
    const at = checks.error.field.replace(/^items/u, `${field}.checks`);
    return invalid(at, checks.error.code);
  }
  return ok({
    title: title.value,
    objective: objective.value,
    minutes,
    content: content.value,
    checks: checks.value.kind === 'questions' ? checks.value.items : lesson.checks,
  });
}

/** What the path writer returns: everything the teacher reviews. */
export interface PathDraft {
  readonly title: string;
  readonly description: string;
  readonly lessons: readonly LearningLesson[];
}

function checkText(input: PathDraft): Checked<PathDraft> {
  const title = text('title', input.title);
  if (!title.ok) return title;
  const description = input.description.trim();
  if (description.length > maxDescriptionLength) return invalid('description', 'too_long');
  if (input.lessons.length < lessonCountRange.min) return invalid('lessons', 'too_short');
  if (input.lessons.length > lessonCountRange.max) return invalid('lessons', 'too_long');
  const lessons: LearningLesson[] = [];
  for (const [index, lesson] of input.lessons.entries()) {
    const checked = checkLesson(`lessons.${String(index)}`, lesson);
    if (!checked.ok) return checked;
    lessons.push(checked.value);
  }
  return ok({ title: title.value, description, lessons });
}

/** Checks a writer's draft with the rules every path follows. */
export const validatePathDraft = (draft: PathDraft): Checked<PathDraft> => checkText(draft);

export function createLearningPath(input: LearningPathInput): Checked<LearningPath> {
  if (!isSubject(input.subject)) return invalid('subject', 'invalid_format');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'invalid_format');
  if (!isLanguage(input.language)) return invalid('language', 'invalid_format');
  if (!isLearningLevel(input.level)) return invalid('level', 'out_of_range');
  const checked = checkText(input);
  if (!checked.ok) return checked;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    studentId: input.studentId,
    classId: input.classId,
    subject: input.subject,
    grade: input.grade,
    language: input.language,
    level: input.level,
    ...checked.value,
    status: 'draft',
    createdAt: input.createdAt,
    assignedAt: null,
  });
}

export interface PathEdit {
  readonly title?: string;
  readonly description?: string;
  readonly lessons?: readonly LearningLesson[];
}

/** The teacher's changes to a draft; an assigned path is what the student is working through. */
export function editPath(path: LearningPath, edit: PathEdit): Checked<LearningPath> {
  if (path.status !== 'draft') return invalid('status', 'not_allowed');
  const checked = checkText({
    title: edit.title ?? path.title,
    description: edit.description ?? path.description,
    lessons: edit.lessons ?? path.lessons,
  });
  return checked.ok ? ok({ ...path, ...checked.value }) : checked;
}

export function assignPath(path: LearningPath, now: Date): Checked<LearningPath> {
  if (path.status !== 'draft') return invalid('status', 'not_allowed');
  return ok({ ...path, status: 'assigned', assignedAt: now });
}

export function archivePath(path: LearningPath): Checked<LearningPath> {
  if (path.status !== 'assigned') return invalid('status', 'not_allowed');
  return ok({ ...path, status: 'archived' });
}

/** A check as the student sees it: no answer. */
export interface LearnerCheck {
  readonly prompt: string;
  readonly options: readonly string[];
}

export interface LearnerLesson {
  readonly title: string;
  readonly objective: string;
  readonly minutes: number;
  readonly content: string;
  readonly checks: readonly LearnerCheck[];
}

export const learnerLesson = (lesson: LearningLesson): LearnerLesson => ({
  title: lesson.title,
  objective: lesson.objective,
  minutes: lesson.minutes,
  content: lesson.content,
  checks: lesson.checks.map(({ prompt, options }) => ({ prompt, options })),
});
