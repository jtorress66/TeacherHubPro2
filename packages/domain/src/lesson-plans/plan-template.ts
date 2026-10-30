import type { PlanTemplateId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { requiredText, type ValidationError } from '../shared/validation.ts';
import type { LessonPlan, PlanBody } from './lesson-plan.ts';

export const maxTemplateNameLength = 100;

/** A teacher's saved plan to start new plans from. */
export interface PlanTemplate {
  readonly id: PlanTemplateId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly name: string;
  readonly title: string | null;
  readonly body: PlanBody;
}

/** Saves the plan's content (not its class or folder) under a name. */
export function templateFromPlan(
  plan: LessonPlan,
  id: PlanTemplateId,
  name: string,
): Result<PlanTemplate, ValidationError> {
  const checked = requiredText('name', name, maxTemplateNameLength);
  if (!checked.ok) return checked;
  return ok({
    id,
    schoolId: plan.schoolId,
    teacherId: plan.teacherId,
    name: checked.value,
    title: plan.title,
    body: plan.body,
  });
}
