import {
  compareDates,
  createAssignment,
  invalid,
  ok,
  updateAssignment,
  type Assignment,
  type AssignmentDetails,
  type AssignmentId,
  type Class,
  type Result,
} from '@thp/domain';
import type {
  AssignmentRepository,
  ClassRepository,
  GradeCategoryRepository,
  GradeRepository,
  IdGenerator,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass, type ClassInput } from './gradebook-access.ts';

export interface AssignmentDeps {
  readonly classes: ClassRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
}

export interface AssignmentInput extends ClassInput {
  readonly assignmentId: AssignmentId;
}

/** Earliest due date first, undated assignments last, then by title. */
export const byDueDate = (a: Assignment, b: Assignment): number => {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return compareDates(a.dueDate, b.dueDate);
  }
  return a.title.localeCompare(b.title);
};

/** A class's assignments in due-date order. */
export async function classAssignments(
  assignments: AssignmentRepository,
  cls: Class,
): Promise<Assignment[]> {
  return [...(await assignments.listByClass(cls.schoolId, cls.id))].sort(byDueDate);
}

/** The assignment, which must belong to the class. */
export async function findClassAssignment(
  assignments: AssignmentRepository,
  cls: Class,
  assignmentId: AssignmentId,
): Promise<Result<Assignment, UseCaseError>> {
  const assignment = await assignments.findById(cls.schoolId, assignmentId);
  return assignment?.classId === cls.id ? ok(assignment) : fail('not_found');
}

/** Validates the details and checks that the category belongs to the same class. */
async function checkCategory(
  deps: AssignmentDeps,
  cls: Class,
  details: AssignmentDetails,
): Promise<Result<true, UseCaseError>> {
  const category = await deps.gradeCategories.findById(cls.schoolId, details.categoryId);
  return category?.classId === cls.id ? ok(true) : invalid('categoryId', 'not_allowed');
}

export class ListAssignments {
  constructor(private readonly deps: AssignmentDeps) {}

  async execute(input: ClassInput): Promise<Result<readonly Assignment[], UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    return ok(await classAssignments(this.deps.assignments, cls.value));
  }
}

export class CreateAssignment {
  constructor(private readonly deps: AssignmentDeps & { readonly ids: IdGenerator }) {}

  async execute(
    input: ClassInput & { details: AssignmentDetails },
  ): Promise<Result<Assignment, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const category = await checkCategory(this.deps, cls.value, input.details);
    if (!category.ok) return category;
    const assignment = createAssignment({
      ...input.details,
      id: this.deps.ids.next() as AssignmentId,
      schoolId: cls.value.schoolId,
      classId: cls.value.id,
    });
    if (!assignment.ok) return assignment;
    await this.deps.assignments.save(assignment.value);
    return assignment;
  }
}

/** Edits an assignment; its grades are kept. */
export class UpdateAssignment {
  constructor(private readonly deps: AssignmentDeps) {}

  async execute(
    input: AssignmentInput & { details: AssignmentDetails },
  ): Promise<Result<Assignment, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const found = await findClassAssignment(this.deps.assignments, cls.value, input.assignmentId);
    if (!found.ok) return found;
    const category = await checkCategory(this.deps, cls.value, input.details);
    if (!category.ok) return category;
    const updated = updateAssignment(found.value, input.details);
    if (!updated.ok) return updated;
    await this.deps.assignments.save(updated.value);
    return updated;
  }
}

/** Deletes an assignment together with its grades. */
export class DeleteAssignment {
  constructor(private readonly deps: AssignmentDeps & { readonly grades: GradeRepository }) {}

  async execute(input: AssignmentInput): Promise<Result<true, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const found = await findClassAssignment(this.deps.assignments, cls.value, input.assignmentId);
    if (!found.ok) return found;
    await this.deps.grades.deleteByAssignment(cls.value.schoolId, found.value.id);
    await this.deps.assignments.delete(cls.value.schoolId, found.value.id);
    return ok(true);
  }
}
