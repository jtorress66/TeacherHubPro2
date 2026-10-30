import {
  activityTypes,
  maxSkills,
  planWeekdays,
  type ClassId,
  type ConversationalBodyInput,
  type PlanBodyInput,
  type PlanDayInput,
  type PlanFolderId,
  type PlanWeekInput,
  type WeeklyBodyInput,
} from '@thp/domain';
import type { Locale } from '@thp/i18n';
import { locale as localeField } from './forms.ts';

/**
 * The lesson plan editor's fields. Weekly plans name each week `w<i>.` and each day `w<i>.d<j>.`;
 * Conversational English plans use their section names. Only the shape is read here: the domain
 * checks the values.
 */
export interface PlanForm {
  readonly locale: Locale;
  readonly planId: string;
  readonly title: string | null;
  readonly classId: ClassId | null;
  readonly folderId: PlanFolderId | null;
  readonly body: PlanBodyInput;
}

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

const all = (data: FormData, name: string): string[] =>
  data.getAll(name).filter((value): value is string => typeof value === 'string');

const optional = (data: FormData, name: string): string | null => {
  const value = field(data, name).trim();
  return value === '' ? null : value;
};

function day(data: FormData, prefix: string): PlanDayInput {
  const chosen = new Set(all(data, `${prefix}.activities`));
  return {
    theme: optional(data, `${prefix}.theme`),
    dok: all(data, `${prefix}.dok`).map(Number),
    eca: all(data, `${prefix}.eca`),
    activities: activityTypes
      .filter((type) => chosen.has(type))
      .map((type) => ({ type, notes: optional(data, `${prefix}.activity.${type}`) })),
    materials: all(data, `${prefix}.materials`),
    notes: optional(data, `${prefix}.notes`),
  };
}

function week(data: FormData, index: number): PlanWeekInput {
  const prefix = `w${String(index)}`;
  return {
    weekStart: field(data, `${prefix}.weekStart`).trim(),
    objective: optional(data, `${prefix}.objective`),
    skills: Array.from({ length: maxSkills }, (_, i) =>
      field(data, `${prefix}.skill.${String(i)}`),
    ),
    standards: field(data, `${prefix}.standards`).split(/[\s,]+/),
    expectations: optional(data, `${prefix}.expectations`),
    days: planWeekdays.map((_, j) => day(data, `${prefix}.d${String(j)}`)),
  };
}

const weekly = (data: FormData): WeeklyBodyInput => ({
  kind: 'weekly',
  unit: optional(data, 'unit'),
  story: optional(data, 'story'),
  teacherName: optional(data, 'teacherName'),
  subjectIntegration: all(data, 'subjectIntegration'),
  weeks: field(data, 'hasWeek2') === 'on' ? [week(data, 0), week(data, 1)] : [week(data, 0)],
});

const conversational = (data: FormData): ConversationalBodyInput => ({
  kind: 'conversational_english',
  subject: optional(data, 'subject'),
  lessonDate: field(data, 'lessonDate').trim(),
  lessonDateEnd: optional(data, 'lessonDateEnd'),
  topic: optional(data, 'topic'),
  learningObjectives: optional(data, 'learningObjectives'),
  materials: optional(data, 'materials'),
  hook: optional(data, 'hook'),
  learningGoal: optional(data, 'learningGoal'),
  closure: optional(data, 'closure'),
  testQuizDate: optional(data, 'testQuizDate'),
  notes: optional(data, 'notes'),
});

const bodies: Readonly<Record<string, (data: FormData) => PlanBodyInput>> = {
  weekly,
  conversational_english: conversational,
};

export function parsePlanForm(data: FormData): PlanForm {
  const readBody = bodies[field(data, 'kind')] ?? weekly;
  return {
    locale: localeField.parse(field(data, 'locale')),
    planId: field(data, 'planId'),
    title: optional(data, 'title'),
    classId: optional(data, 'classId') as ClassId | null,
    folderId: optional(data, 'folderId') as PlanFolderId | null,
    body: readBody(data),
  };
}

/** The form field a domain error path belongs to: `weeks.0.days.2.theme` is `w0.d2.theme`. */
export const planFieldName = (path: string): string =>
  path.replace(/^weeks\.(\d+)/, 'w$1').replace(/\.days\.(\d+)/, '.d$1');
