import type { ClassId, LessonPlanId, PlanFolderId, SchoolId, UserId } from '../shared/ids.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import {
  conversationalBody,
  shiftConversational,
  type ConversationalBody,
  type ConversationalBodyInput,
} from './conversational-plan.ts';
import { daysBetween } from './plan-fields.ts';
import { shiftWeekly, weeklyBody, type WeeklyBody, type WeeklyBodyInput } from './weekly-plan.ts';

export const lessonPlanKinds = ['weekly', 'conversational_english'] as const;

export type LessonPlanKind = (typeof lessonPlanKinds)[number];

export type PlanBody = WeeklyBody | ConversationalBody;
export type PlanBodyInput = WeeklyBodyInput | ConversationalBodyInput;

export interface LessonPlan {
  readonly id: LessonPlanId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string | null;
  readonly classId: ClassId | null;
  readonly folderId: PlanFolderId | null;
  readonly body: PlanBody;
}

export interface LessonPlanInput {
  readonly id: LessonPlanId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title?: string | null;
  readonly classId?: ClassId | null;
  readonly folderId?: PlanFolderId | null;
  readonly body: PlanBodyInput;
}

/** The first and last day a plan covers, for the calendar. */
export interface PlanSpan {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

/** Everything that differs by kind, so a new kind is a new entry, not a new branch. */
interface KindRules<B extends PlanBody, I extends PlanBodyInput> {
  readonly title: (value: string | null | undefined) => Result<string | null, ValidationError>;
  readonly body: (input: I) => Result<B, ValidationError>;
  readonly span: (body: B) => PlanSpan;
  readonly shift: (body: B, days: number) => B;
}

const weeklyRules: KindRules<WeeklyBody, WeeklyBodyInput> = {
  title: (value) => optionalText('title', value),
  body: weeklyBody,
  span: ({ weeks }) => {
    const [first, ...later] = weeks.map((week) => week.weekStart);
    if (first === undefined) throw new Error('A weekly plan always has a week.');
    return { start: first, end: addDays(later.at(-1) ?? first, 4) };
  },
  shift: shiftWeekly,
};

/** A Conversational English plan needs a title. */
const conversationalRules: KindRules<ConversationalBody, ConversationalBodyInput> = {
  title: (value) => requiredText('title', value ?? undefined),
  body: conversationalBody,
  span: (body) => ({ start: body.lessonDate, end: body.lessonDateEnd ?? body.lessonDate }),
  shift: shiftConversational,
};

const rules: Readonly<Record<LessonPlanKind, KindRules<PlanBody, PlanBodyInput>>> = {
  weekly: weeklyRules as unknown as KindRules<PlanBody, PlanBodyInput>,
  conversational_english: conversationalRules as unknown as KindRules<PlanBody, PlanBodyInput>,
};

export function createLessonPlan(input: LessonPlanInput): Result<LessonPlan, ValidationError> {
  const kind = rules[input.body.kind];
  const title = kind.title(input.title);
  if (!title.ok) return title;
  const body = kind.body(input.body);
  if (!body.ok) return body;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    title: title.value,
    classId: input.classId ?? null,
    folderId: input.folderId ?? null,
    body: body.value,
  });
}

/** Replaces a plan's editable content; its id, school and teacher stay. */
export const updateLessonPlan = (
  plan: LessonPlan,
  changes: Omit<LessonPlanInput, 'id' | 'schoolId' | 'teacherId'>,
): Result<LessonPlan, ValidationError> =>
  createLessonPlan({ ...changes, id: plan.id, schoolId: plan.schoolId, teacherId: plan.teacherId });

export const planKind = (plan: LessonPlan): LessonPlanKind => plan.body.kind;

export const planSpan = (body: PlanBody): PlanSpan => rules[body.kind].span(body);

/** The same content moved so that it starts on `start`; every date moves by the same amount. */
export function movePlanBody(body: PlanBody, start: LocalDate): PlanBody {
  return rules[body.kind].shift(body, daysBetween(planSpan(body).start, start));
}

/** A copy of a plan for another week (or date), keeping its class and folder. */
export const duplicateLessonPlan = (
  plan: LessonPlan,
  id: LessonPlanId,
  start: LocalDate,
): LessonPlan => ({ ...plan, id, body: movePlanBody(plan.body, start) });
