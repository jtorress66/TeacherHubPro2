import {
  isAdminOf,
  ok,
  type ClassId,
  type LessonPlan,
  type LessonPlanId,
  type PlanFolderId,
  type Result,
  type User,
  type UserId,
} from '@thp/domain';
import type { ClassRepository, LessonPlanRepository, PlanFolderRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';

/** A plan in the actor's school that is theirs, or any plan there for a school admin. */
export async function findPlan(
  plans: LessonPlanRepository,
  actor: User,
  planId: LessonPlanId,
): Promise<Result<LessonPlan, UseCaseError>> {
  const plan = await plans.findById(actor.schoolId, planId);
  if (!plan) return fail('not_found');
  return plan.teacherId === actor.id || isAdminOf(actor, plan.schoolId)
    ? ok(plan)
    : fail('forbidden');
}

/** A plan's class must be one the actor manages. */
export async function checkClass(
  classes: ClassRepository,
  actor: User,
  classId: ClassId | null | undefined,
): Promise<Result<true, UseCaseError>> {
  if (classId === null || classId === undefined) return ok(true);
  const cls = await findManagedClass(classes, actor, classId);
  return cls.ok ? ok(true) : cls;
}

/** A plan's folder must belong to the plan's teacher. */
export async function checkFolder(
  folders: PlanFolderRepository,
  actor: User,
  teacherId: UserId,
  folderId: PlanFolderId | null | undefined,
): Promise<Result<true, UseCaseError>> {
  if (folderId === null || folderId === undefined) return ok(true);
  const folder = await folders.findById(actor.schoolId, folderId);
  return folder?.teacherId === teacherId ? ok(true) : fail('not_found');
}
