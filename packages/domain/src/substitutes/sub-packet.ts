import type { ClassId, SchoolId } from '../shared/ids.ts';
import { addDays, compareDates, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, type ValidationError } from '../shared/validation.ts';
import { planSpan, type LessonPlan } from '../lesson-plans/lesson-plan.ts';
import type { PlanWeek } from '../lesson-plans/weekly-plan.ts';
import { longText } from '../lesson-plans/plan-fields.ts';

export const maxExtensionLength = 40;

/** What a teacher writes for a substitute, saved per class. The rest of the packet is looked up. */
export interface SubPacket {
  readonly classId: ClassId;
  readonly schoolId: SchoolId;
  readonly mainOfficeExt: string | null;
  readonly nurseExt: string | null;
  readonly dailyRoutines: string | null;
  readonly emergencyProcedures: string | null;
  readonly additionalNotes: string | null;
  /** Whether the roster shows students' accommodations to the substitute. */
  readonly includeAccommodations: boolean;
}

export interface SubPacketInput {
  readonly classId: ClassId;
  readonly schoolId: SchoolId;
  readonly mainOfficeExt?: string | null;
  readonly nurseExt?: string | null;
  readonly dailyRoutines?: string | null;
  readonly emergencyProcedures?: string | null;
  readonly additionalNotes?: string | null;
  readonly includeAccommodations?: boolean;
}

const notes = ['dailyRoutines', 'emergencyProcedures', 'additionalNotes'] as const;
const extensions = ['mainOfficeExt', 'nurseExt'] as const;

export function createSubPacket(input: SubPacketInput): Result<SubPacket, ValidationError> {
  const texts: Partial<
    Record<(typeof notes)[number] | (typeof extensions)[number], string | null>
  > = {};
  for (const field of extensions) {
    const text = optionalText(field, input[field], maxExtensionLength);
    if (!text.ok) return text;
    texts[field] = text.value;
  }
  for (const field of notes) {
    const text = longText(field, input[field]);
    if (!text.ok) return text;
    texts[field] = text.value;
  }
  return ok({
    classId: input.classId,
    schoolId: input.schoolId,
    mainOfficeExt: texts.mainOfficeExt ?? null,
    nurseExt: texts.nurseExt ?? null,
    dailyRoutines: texts.dailyRoutines ?? null,
    emergencyProcedures: texts.emergencyProcedures ?? null,
    additionalNotes: texts.additionalNotes ?? null,
    includeAccommodations: input.includeAccommodations ?? true,
  });
}

/** Seats in roster order, front row first. */
export function seatingRows<T>(students: readonly T[], perRow: number): T[][] {
  const rows: T[][] = [];
  for (let start = 0; start < students.length; start += perRow) {
    rows.push(students.slice(start, start + perRow));
  }
  return rows;
}

/** The weekly plan the class follows on a date: the one covering it that started latest. */
export function planOnDate(plans: readonly LessonPlan[], date: LocalDate): LessonPlan | null {
  const covering = plans.filter((plan) => {
    if (plan.body.kind !== 'weekly') return false;
    const span = planSpan(plan.body);
    return compareDates(span.start, date) <= 0 && compareDates(date, span.end) <= 0;
  });
  const latest = covering.sort((a, b) =>
    compareDates(planSpan(b.body).start, planSpan(a.body).start),
  );
  return latest[0] ?? null;
}

/** The week of a weekly plan (Monday to Friday) that covers the date, if any. */
export function weekOnDate(plan: LessonPlan, date: LocalDate): PlanWeek | null {
  if (plan.body.kind !== 'weekly') return null;
  return (
    plan.body.weeks.find(
      (week) =>
        compareDates(week.weekStart, date) <= 0 &&
        compareDates(date, addDays(week.weekStart, 4)) <= 0,
    ) ?? null
  );
}
