import {
  ok,
  type Assignment,
  type AssignmentId,
  type Class,
  type ClassId,
  type Result,
  type User,
} from '@thp/domain';
import type { AssignmentRepository, ClassRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';

export interface AssignmentRef {
  readonly actor: User;
  readonly classId: ClassId;
  readonly assignmentId: AssignmentId;
}

export interface AssignmentAccessDeps {
  readonly classes: ClassRepository;
  readonly assignments: AssignmentRepository;
}

async function inClass(
  assignments: AssignmentRepository,
  cls: Result<Class, UseCaseError>,
  assignmentId: AssignmentId,
): Promise<Result<{ cls: Class; assignment: Assignment }, UseCaseError>> {
  if (!cls.ok) return cls;
  const assignment = await assignments.findById(cls.value.schoolId, assignmentId);
  return assignment?.classId === cls.value.id
    ? ok({ cls: cls.value, assignment })
    : fail('not_found');
}

/** An assignment in a class the actor manages and may still change (not archived). */
export const editableAssignment = async (deps: AssignmentAccessDeps, ref: AssignmentRef) =>
  inClass(
    deps.assignments,
    await findEditableClass(deps.classes, ref.actor, ref.classId),
    ref.assignmentId,
  );

/** An assignment in a class the actor manages, archived or not (for reading). */
export const managedAssignment = async (deps: AssignmentAccessDeps, ref: AssignmentRef) =>
  inClass(
    deps.assignments,
    await findManagedClass(deps.classes, ref.actor, ref.classId),
    ref.assignmentId,
  );
