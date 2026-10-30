import { compareDates, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';
import { findStandard } from '../standards/common-core.ts';
import { isMonday, longText, shiftDate, subsetOf } from './plan-fields.ts';

export const planWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export const activityTypes = [
  'brainstorming',
  'building_background',
  'vocabulary',
  'read_pages',
  'guided_reading',
  'oral_questions',
  'comprehension_questions',
  'exercise_practice',
  'other',
] as const;
export const materialTypes = [
  'book',
  'notebook',
  'teachers_guide',
  'test_quiz',
  'dictionary',
  'handouts',
  'other',
] as const;
/** Webb's Depth of Knowledge: recall, skills, strategic thinking, extended thinking. */
export const dokLevels = [1, 2, 3, 4] as const;
/** Enrichment, core and assessment marks on a day. */
export const ecaMarks = ['enrichment', 'core', 'assessment'] as const;
export const subjectIntegrations = [
  'mathematics',
  'spanish',
  'english',
  'social_studies',
  'science',
  'health',
  'art',
  'physical_education',
  'religion',
] as const;
export const maxSkills = 4;
export const maxWeeks = 2;

export type ActivityType = (typeof activityTypes)[number];
export type MaterialType = (typeof materialTypes)[number];
export type DokLevel = (typeof dokLevels)[number];
export type EcaMark = (typeof ecaMarks)[number];
export type SubjectIntegration = (typeof subjectIntegrations)[number];

export interface PlanActivity {
  readonly type: ActivityType;
  readonly notes: string | null;
}

/** One school day; its date is the week's Monday plus its position. */
export interface PlanDay {
  readonly theme: string | null;
  readonly dok: readonly DokLevel[];
  readonly eca: readonly EcaMark[];
  readonly activities: readonly PlanActivity[];
  readonly materials: readonly MaterialType[];
  readonly notes: string | null;
}

export interface PlanWeek {
  readonly weekStart: LocalDate;
  readonly objective: string | null;
  readonly skills: readonly string[];
  /** Official Common Core codes only. */
  readonly standards: readonly string[];
  readonly expectations: string | null;
  readonly days: readonly PlanDay[];
}

export interface WeeklyBody {
  readonly kind: 'weekly';
  readonly unit: string | null;
  readonly story: string | null;
  readonly teacherName: string | null;
  readonly subjectIntegration: readonly SubjectIntegration[];
  readonly weeks: readonly PlanWeek[];
}

export interface PlanDayInput {
  readonly theme?: string | null;
  readonly dok?: readonly number[];
  readonly eca?: readonly string[];
  readonly activities?: readonly { readonly type: string; readonly notes?: string | null }[];
  readonly materials?: readonly string[];
  readonly notes?: string | null;
}

export interface PlanWeekInput {
  readonly weekStart: string;
  readonly objective?: string | null;
  readonly skills?: readonly string[];
  readonly standards?: readonly string[];
  readonly expectations?: string | null;
  /** Monday to Friday; missing means five blank days. */
  readonly days?: readonly PlanDayInput[];
}

export interface WeeklyBodyInput {
  readonly kind: 'weekly';
  readonly unit?: string | null;
  readonly story?: string | null;
  readonly teacherName?: string | null;
  readonly subjectIntegration?: readonly string[];
  readonly weeks: readonly PlanWeekInput[];
}

type Checked<T> = Result<T, ValidationError>;

function activities(field: string, input: PlanDayInput['activities']): Checked<PlanActivity[]> {
  const result: PlanActivity[] = [];
  for (const activity of input ?? []) {
    if (!(activityTypes as readonly string[]).includes(activity.type)) {
      return invalid(field, 'invalid_format');
    }
    if (result.some((a) => a.type === activity.type)) return invalid(field, 'duplicate');
    const notes = longText(field, activity.notes);
    if (!notes.ok) return notes;
    result.push({ type: activity.type as ActivityType, notes: notes.value });
  }
  return ok(activityTypes.flatMap((type) => result.filter((a) => a.type === type)));
}

function day(field: string, input: PlanDayInput): Checked<PlanDay> {
  const theme = optionalText(`${field}.theme`, input.theme);
  if (!theme.ok) return theme;
  const dok = subsetOf(`${field}.dok`, input.dok, dokLevels);
  if (!dok.ok) return dok;
  const eca = subsetOf(`${field}.eca`, input.eca, ecaMarks);
  if (!eca.ok) return eca;
  const chosen = activities(`${field}.activities`, input.activities);
  if (!chosen.ok) return chosen;
  const materials = subsetOf(`${field}.materials`, input.materials, materialTypes);
  if (!materials.ok) return materials;
  const notes = longText(`${field}.notes`, input.notes);
  if (!notes.ok) return notes;
  return ok({
    theme: theme.value,
    dok: dok.value,
    eca: eca.value,
    activities: chosen.value,
    materials: materials.value,
    notes: notes.value,
  });
}

function skills(field: string, input: readonly string[] | undefined): Checked<string[]> {
  const result: string[] = [];
  for (const value of input ?? []) {
    const skill = optionalText(field, value);
    if (!skill.ok) return skill;
    if (skill.value !== null) result.push(skill.value);
  }
  return result.length > maxSkills ? invalid(field, 'out_of_range') : ok(result);
}

function standards(field: string, input: readonly string[] | undefined): Checked<string[]> {
  const codes = [...new Set((input ?? []).map((code) => code.trim()).filter(Boolean))];
  return codes.every((code) => findStandard(code) !== null)
    ? ok(codes)
    : invalid(field, 'not_allowed');
}

export const blankDay: PlanDay = {
  theme: null,
  dok: [],
  eca: [],
  activities: [],
  materials: [],
  notes: null,
};

function week(field: string, input: PlanWeekInput): Checked<PlanWeek> {
  const weekStart = parseLocalDate(`${field}.weekStart`, input.weekStart);
  if (!weekStart.ok) return weekStart;
  if (!isMonday(weekStart.value)) return invalid(`${field}.weekStart`, 'not_allowed');
  const objective = longText(`${field}.objective`, input.objective);
  if (!objective.ok) return objective;
  const chosenSkills = skills(`${field}.skills`, input.skills);
  if (!chosenSkills.ok) return chosenSkills;
  const codes = standards(`${field}.standards`, input.standards);
  if (!codes.ok) return codes;
  const expectations = longText(`${field}.expectations`, input.expectations);
  if (!expectations.ok) return expectations;
  const dayInputs = input.days ?? planWeekdays.map(() => ({}));
  if (dayInputs.length !== planWeekdays.length) return invalid(`${field}.days`, 'out_of_range');
  const days: PlanDay[] = [];
  for (const [index, dayInput] of dayInputs.entries()) {
    const checked = day(`${field}.days.${String(index)}`, dayInput);
    if (!checked.ok) return checked;
    days.push(checked.value);
  }
  return ok({
    weekStart: weekStart.value,
    objective: objective.value,
    skills: chosenSkills.value,
    standards: codes.value,
    expectations: expectations.value,
    days,
  });
}

/** One or two weeks of Monday-to-Friday plans; week 2 starts after week 1. */
export function weeklyBody(input: WeeklyBodyInput): Checked<WeeklyBody> {
  const unit = optionalText('unit', input.unit);
  if (!unit.ok) return unit;
  const story = optionalText('story', input.story);
  if (!story.ok) return story;
  const teacherName = optionalText('teacherName', input.teacherName);
  if (!teacherName.ok) return teacherName;
  const integration = subsetOf('subjectIntegration', input.subjectIntegration, subjectIntegrations);
  if (!integration.ok) return integration;
  if (input.weeks.length === 0 || input.weeks.length > maxWeeks) {
    return invalid('weeks', 'out_of_range');
  }
  const weeks: PlanWeek[] = [];
  for (const [index, weekInput] of input.weeks.entries()) {
    const checked = week(`weeks.${String(index)}`, weekInput);
    if (!checked.ok) return checked;
    const previous = weeks.at(-1);
    if (previous && compareDates(checked.value.weekStart, previous.weekStart) <= 0) {
      return invalid(`weeks.${String(index)}.weekStart`, 'invalid_order');
    }
    weeks.push(checked.value);
  }
  return ok({
    kind: 'weekly',
    unit: unit.value,
    story: story.value,
    teacherName: teacherName.value,
    subjectIntegration: integration.value,
    weeks,
  });
}

export const shiftWeekly = (body: WeeklyBody, days: number): WeeklyBody => ({
  ...body,
  weeks: body.weeks.map((w) => ({ ...w, weekStart: shiftDate(w.weekStart, days) })),
});
