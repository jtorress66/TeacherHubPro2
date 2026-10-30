import {
  createLessonPlan,
  draftedPlan,
  err,
  ok,
  type DraftRequest,
  type LessonPlanDraft,
  type LessonPlanId,
  type Result,
  type SchoolId,
  type UserId,
  type ValidationError,
} from '@thp/domain';
import type { LlmResponse } from '@thp/ports';
import { parseJsonObject } from './json-reply.ts';
import type { PlanFormat } from './plan-formats.ts';

const ruleBroken = ({ field, code }: ValidationError): string =>
  code === 'too_long'
    ? `"${field}" is too long; keep it within the limit given in the shape.`
    : `"${field}" breaks a plan rule (${code}).`;

/**
 * Turns a model reply into a usable draft, or says in plain words what is wrong with it, so the
 * model can correct it and an eval can report it. A draft must also make a valid plan.
 */
export function reviewReply(
  format: PlanFormat,
  request: DraftRequest,
  reply: LlmResponse,
): Result<LessonPlanDraft, string> {
  if (reply.stopReason === 'max_tokens') {
    return err('The reply was cut off before the end; write shorter texts so the JSON fits.');
  }
  const json = parseJsonObject(reply.text);
  if (json === null) return err('The reply was not one JSON object.');
  const draft = format.parse(json, request);
  if (draft === null) return err('The reply is missing required fields or has the wrong shape.');
  const plan = createLessonPlan({
    id: 'draft' as LessonPlanId,
    schoolId: 'draft' as SchoolId,
    teacherId: 'draft' as UserId,
    ...draftedPlan(draft, request.start),
  });
  return plan.ok ? ok(draft) : err(ruleBroken(plan.error));
}
