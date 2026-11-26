import {
  describeStandard,
  ok,
  planStandardCodes,
  setAssignmentStandards,
  type Result,
  type StandardInfo,
  type User,
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

/** The most planned codes offered as suggestions in the game builder. */
export const maxPlannedSuggestions = 40;

/**
 * The standards in the lesson plans of the actor's own classes, once each, for the game builder
 * to suggest. Only the actor's school and classes are read.
 */
export class ListPlannedStandards {
  constructor(private readonly deps: Pick<AssignmentStandardsDeps, 'classes' | 'lessonPlans'>) {}

  async execute(input: { readonly actor: User }): Promise<readonly StandardInfo[]> {
    const { actor } = input;
    const classes = await this.deps.classes.listByTeacher(actor.schoolId, actor.id);
    const plans = await Promise.all(
      classes.map((cls) => this.deps.lessonPlans.listByClass(actor.schoolId, cls.id)),
    );
    const codes = new Set(plans.flat().flatMap((plan) => planStandardCodes(plan.body)));
    return [...codes].slice(0, maxPlannedSuggestions).map(describeStandard);
  }
}
