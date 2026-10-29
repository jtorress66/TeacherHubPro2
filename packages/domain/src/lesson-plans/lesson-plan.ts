import type { ClassId, LessonPlanId, PlanFolderId, SchoolId, UserId } from '../shared/ids.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import type { Weekday } from '../shared/weekday.ts';

export type LessonPlanKind = 'weekly' | 'conversational_english';

export interface LessonPlanDay {
  readonly weekday: Weekday;
  readonly content: string;
}

/** The core of a lesson plan; step 8 adds the detailed sections. */
export interface LessonPlan {
  readonly id: LessonPlanId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly kind: LessonPlanKind;
  readonly title: string | null;
  readonly weekStart: LocalDate;
  readonly classId: ClassId | null;
  readonly folderId: PlanFolderId | null;
  readonly days: readonly LessonPlanDay[];
  readonly standards: readonly string[];
}

export interface LessonPlanInput {
  readonly id: LessonPlanId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly kind: LessonPlanKind;
  readonly weekStart: string;
  readonly title?: string | null;
  readonly classId?: ClassId | null;
  readonly folderId?: PlanFolderId | null;
  readonly days?: readonly LessonPlanDay[];
  readonly standards?: readonly string[];
}

export function createLessonPlan(input: LessonPlanInput): Result<LessonPlan, ValidationError> {
  const title =
    input.kind === 'conversational_english'
      ? requiredText('title', input.title ?? undefined)
      : optionalText('title', input.title);
  if (!title.ok) return title;
  const weekStart = parseLocalDate('weekStart', input.weekStart);
  if (!weekStart.ok) return weekStart;
  const days = input.days ?? [];
  if (new Set(days.map((day) => day.weekday)).size !== days.length) {
    return invalid('days', 'duplicate');
  }

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    kind: input.kind,
    title: title.value,
    weekStart: weekStart.value,
    classId: input.classId ?? null,
    folderId: input.folderId ?? null,
    days,
    standards: input.standards ?? [],
  });
}
