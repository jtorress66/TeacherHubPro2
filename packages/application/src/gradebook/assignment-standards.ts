import {
  describeStandard,
  ok,
  planStandardCodes,
  setAssignmentStandards,
  type Result,
  type StandardInfo,
} from '@thp/domain';
import type { AssignmentRepository, ClassRepository, LessonPlanRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import type { UseCaseError } from '../errors.ts';
import { findClassAssignment, type AssignmentInput } from './assignments.ts';
import { findEditableClass } from './gradebook-access.ts';

export interface AssignmentStandardsDeps {
  readonly classes: ClassRepository;
  readonly assignments: AssignmentRepository;
  readonly lessonPlans: LessonPlanRepository;
}

/** The standards an assignment tests, and the class's planned codes it does not test yet. */
export interface AssignmentStandards {
  readonly standards: readonly StandardInfo[];
  readonly suggestions: readonly StandardInfo[];
}

export class GetAssignmentStandards {
  constructor(private readonly deps: AssignmentStandardsDeps) {}

  async execute(input: AssignmentInput): Promise<Result<AssignmentStandards, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const found = await findClassAssignment(this.deps.assignments, cls.value, input.assignmentId);
    if (!found.ok) return found;
    const plans = await this.deps.lessonPlans.listByClass(cls.value.schoolId, cls.value.id);
    const tagged = new Set(found.value.standards);
    const planned = [...new Set(plans.flatMap((plan) => planStandardCodes(plan.body)))];
    return ok({
      standards: found.value.standards.map(describeStandard),
      suggestions: planned.filter((code) => !tagged.has(code)).map(describeStandard),
    });
  }
}

/** Replaces the standards an assignment tests; its teacher (or a school admin) chooses them. */
export class SetAssignmentStandards {
  constructor(private readonly deps: Omit<AssignmentStandardsDeps, 'lessonPlans'>) {}

  async execute(
    input: AssignmentInput & { readonly standards: readonly string[] },
  ): Promise<Result<true, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const found = await findClassAssignment(this.deps.assignments, cls.value, input.assignmentId);
    if (!found.ok) return found;
    const tagged = setAssignmentStandards(found.value, input.standards);
    if (!tagged.ok) return tagged;
    await this.deps.assignments.save(tagged.value);
    return ok(true);
  }
}
