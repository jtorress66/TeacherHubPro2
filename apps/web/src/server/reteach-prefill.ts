import {
  assistantSubjects,
  contentMinutesRange,
  contentTypes,
  gradeLevels,
  isLanguage,
  maxInstructionsLength,
  maxShortTextLength,
  questionCountRange,
  watchPercent,
  type AssistantSubject,
  type GradeLevel,
  type StandardCoverage,
} from '@thp/domain';
import { createTranslator, locales, type Locale } from '@thp/i18n';
import type { SubmittedValues } from './form-values.ts';

export type ReteachKind = 'lesson' | 'quiz';

/** The assistant form's fields, as a link carries them. */
export type ReteachValues = Readonly<Record<string, string>> & {
  readonly type: string;
  readonly topic: string;
  readonly instructions: string;
};

/** How long a reteach lesson is, and how many questions a re-check quiz has. */
export const reteachMinutes = 30;
export const recheckQuestions = 5;

interface ClassInfo {
  readonly subject: string | null;
  readonly grade: string | null;
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/** The assistant subject a class's typed subject names, in any language, when there is one. */
function subjectOf(subject: string | null): AssistantSubject | undefined {
  if (subject === null) return undefined;
  const wanted = fold(subject);
  return assistantSubjects.find(
    (id) =>
      fold(id) === wanted ||
      locales.some(
        (locale) => fold(createTranslator(locale)(`assistant.subject_${id}`)) === wanted,
      ),
  );
}

/** A class grade such as "4", "4th" or "K", when it is one the assistant knows. */
function gradeOf(grade: string | null): GradeLevel | undefined {
  const match = /^(k|\d{1,2})(st|nd|rd|th|º|°|o)?$/iu.exec(grade?.trim() ?? '');
  const level = match?.[1]?.toUpperCase();
  return gradeLevels.find((g) => g === level);
}

function topicOf(row: StandardCoverage): string {
  const { code, description } = row.standard;
  const topic = description === null ? code : `${code}: ${description}`;
  return topic.length <= maxShortTextLength
    ? topic
    : `${topic.slice(0, maxShortTextLength - 1).trimEnd()}…`;
}

/**
 * The assistant's starting values for reteaching a standard, or re-checking it with a short quiz.
 * Only the code, its description and class counts are used: never a student's name.
 */
export function reteachValues(
  locale: Locale,
  row: StandardCoverage,
  cls: ClassInfo,
  kind: ReteachKind,
): ReteachValues {
  const t = createTranslator(locale);
  const code = row.standard.code;
  const lesson = kind === 'lesson';
  const values: Record<string, string> & ReteachValues = {
    type: lesson ? 'lesson_plan' : 'quiz',
    topic: topicOf(row),
    language: locale,
    followCurriculum: 'on',
    instructions: lesson
      ? t('standards.reteachLessonInstructions', {
          code,
          average: row.average ?? 0,
          below: row.studentsBelow,
          scored: row.studentsScored,
          percent: watchPercent,
        })
      : t('standards.reteachQuizInstructions', { code }),
    ...(lesson
      ? { durationMinutes: String(reteachMinutes) }
      : { questionCount: String(recheckQuestions) }),
  };
  const subject = subjectOf(cls.subject);
  const grade = gradeOf(cls.grade);
  if (subject !== undefined) values.subject = subject;
  if (grade !== undefined) values.grade = grade;
  return values;
}

export function reteachHref(
  locale: Locale,
  row: StandardCoverage,
  cls: ClassInfo,
  kind: ReteachKind,
): string {
  return `/${locale}/app/assistant?${new URLSearchParams(reteachValues(locale, row, cls, kind)).toString()}`;
}

const wholeIn = (value: string, range: { min: number; max: number }) =>
  /^\d{1,3}$/u.test(value) && Number(value) >= range.min && Number(value) <= range.max;

/** Which link values the assistant form accepts as a start, and how each is checked. */
const accepted: Readonly<Record<string, (value: string) => boolean>> = {
  type: (v) => (contentTypes as readonly string[]).includes(v),
  subject: (v) => (assistantSubjects as readonly string[]).includes(v),
  grade: (v) => (gradeLevels as readonly string[]).includes(v),
  language: isLanguage,
  topic: (v) => v.trim() !== '' && v.length <= maxShortTextLength,
  instructions: (v) => v.length <= maxInstructionsLength,
  durationMinutes: (v) => wholeIn(v, contentMinutesRange),
  questionCount: (v) => wholeIn(v, questionCountRange),
};

/**
 * The assistant form's starting values from a link (such as a reteach link), keeping only valid
 * ones; undefined when there are none. The school's guide stays on, as it is by default.
 */
export function assistantStart(
  search: Readonly<Record<string, string | string[] | undefined>>,
): SubmittedValues | undefined {
  const values: Record<string, string> = {};
  for (const [name, check] of Object.entries(accepted)) {
    const value = search[name];
    if (typeof value === 'string' && check(value)) values[name] = value;
  }
  if (Object.keys(values).length === 0) return undefined;
  return { ...values, followCurriculum: 'on' };
}
