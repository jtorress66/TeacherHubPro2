import {
  compareDates,
  createLessonPlan,
  duplicateLessonPlan,
  ok,
  parseLocalDate,
  planSpan,
  updateLessonPlan,
  type ClassId,
  type LessonPlan,
  type LessonPlanId,
  type PlanBodyInput,
  type PlanFolderId,
  type Result,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  IdGenerator,
  LessonPlanRepository,
  PlanFolderRepository,
} from '@thp/ports';
import type { UseCaseError } from '../errors.ts';
import { checkClass, checkFolder, findPlan } from './plan-access.ts';

export interface PlanDeps {
  readonly lessonPlans: LessonPlanRepository;
  readonly planFolders: PlanFolderRepository;
  readonly classes: ClassRepository;
}

export interface PlanContent {
  readonly title?: string | null;
  readonly classId?: ClassId | null;
  readonly folderId?: PlanFolderId | null;
  readonly body: PlanBodyInput;
}

interface PlanInput {
  readonly actor: User;
  readonly planId: LessonPlanId;
}

/** All plans, the plans in no folder, or one folder's plans. */
export type PlanFilter = 'all' | 'unfiled' | PlanFolderId;

const inFilter = (filter: PlanFilter) => (plan: LessonPlan) =>
  filter === 'all' ? true : plan.folderId === (filter === 'unfiled' ? null : filter);

/** Latest first, by the date each plan starts. */
const byStartDescending = (a: LessonPlan, b: LessonPlan) =>
  compareDates(planSpan(b.body).start, planSpan(a.body).start);

async function checkLinks(
  deps: PlanDeps,
  actor: User,
  plan: LessonPlan,
): Promise<Result<LessonPlan, UseCaseError>> {
  const cls = await checkClass(deps.classes, actor, plan.classId);
  if (!cls.ok) return cls;
  const folder = await checkFolder(deps.planFolders, actor, plan.teacherId, plan.folderId);
  return folder.ok ? ok(plan) : folder;
}

export class ListPlans {
  constructor(private readonly deps: Pick<PlanDeps, 'lessonPlans'>) {}

  async execute(input: { actor: User; filter?: PlanFilter }): Promise<readonly LessonPlan[]> {
    const plans = await this.deps.lessonPlans.listByTeacher(input.actor.schoolId, input.actor.id);
    return plans.filter(inFilter(input.filter ?? 'all')).sort(byStartDescending);
  }
}

export class GetPlan {
  constructor(private readonly deps: Pick<PlanDeps, 'lessonPlans'>) {}

  execute(input: PlanInput): Promise<Result<LessonPlan, UseCaseError>> {
    return findPlan(this.deps.lessonPlans, input.actor, input.planId);
  }
}

/** Saves a new plan for the actor; its class and folder must be theirs. */
export class CreatePlan {
  constructor(private readonly deps: PlanDeps & { readonly ids: IdGenerator }) {}

  async execute(input: { actor: User } & PlanContent): Promise<Result<LessonPlan, UseCaseError>> {
    const { actor, ...content } = input;
    const plan = createLessonPlan({
      ...content,
      id: this.deps.ids.next() as LessonPlanId,
      schoolId: actor.schoolId,
      teacherId: actor.id,
    });
    if (!plan.ok) return plan;
    const checked = await checkLinks(this.deps, actor, plan.value);
    if (!checked.ok) return checked;
    await this.deps.lessonPlans.save(plan.value);
    return plan;
  }
}

export class UpdatePlan {
  constructor(private readonly deps: PlanDeps) {}

  async execute(input: PlanInput & PlanContent): Promise<Result<LessonPlan, UseCaseError>> {
    const { actor, planId, ...content } = input;
    const found = await findPlan(this.deps.lessonPlans, actor, planId);
    if (!found.ok) return found;
    const plan = updateLessonPlan(found.value, content);
    if (!plan.ok) return plan;
    const checked = await checkLinks(this.deps, actor, plan.value);
    if (!checked.ok) return checked;
    await this.deps.lessonPlans.save(plan.value);
    return plan;
  }
}

export class DeletePlan {
  constructor(private readonly deps: Pick<PlanDeps, 'lessonPlans'>) {}

  async execute(input: PlanInput): Promise<Result<true, UseCaseError>> {
    const found = await findPlan(this.deps.lessonPlans, input.actor, input.planId);
    if (!found.ok) return found;
    await this.deps.lessonPlans.delete(found.value.schoolId, found.value.id);
    return ok(true);
  }
}

/** Copies a plan to start on another date (the week's Monday for a weekly plan). */
export class DuplicatePlan {
  constructor(
    private readonly deps: Pick<PlanDeps, 'lessonPlans'> & { readonly ids: IdGenerator },
  ) {}

  async execute(input: PlanInput & { start: string }): Promise<Result<LessonPlan, UseCaseError>> {
    const found = await findPlan(this.deps.lessonPlans, input.actor, input.planId);
    if (!found.ok) return found;
    const start = parseLocalDate('start', input.start);
    if (!start.ok) return start;
    const copy = duplicateLessonPlan(
      found.value,
      this.deps.ids.next() as LessonPlanId,
      start.value,
    );
    const checked = createLessonPlan({ ...copy, body: copy.body });
    if (!checked.ok) return checked;
    await this.deps.lessonPlans.save(checked.value);
    return checked;
  }
}

/** Files a plan in one of its teacher's folders, or back in Unfiled. */
export class MovePlan {
  constructor(private readonly deps: Pick<PlanDeps, 'lessonPlans' | 'planFolders'>) {}

  async execute(
    input: PlanInput & { folderId: PlanFolderId | null },
  ): Promise<Result<LessonPlan, UseCaseError>> {
    const found = await findPlan(this.deps.lessonPlans, input.actor, input.planId);
    if (!found.ok) return found;
    const folder = await checkFolder(
      this.deps.planFolders,
      input.actor,
      found.value.teacherId,
      input.folderId,
    );
    if (!folder.ok) return folder;
    const moved = { ...found.value, folderId: input.folderId };
    await this.deps.lessonPlans.save(moved);
    return ok(moved);
  }
}
