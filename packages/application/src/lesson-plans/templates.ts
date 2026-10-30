import {
  findStarter,
  movePlanBody,
  ok,
  parseLocalDate,
  starterBody,
  starterTemplates,
  templateFromPlan,
  templateOfTheWeek,
  type DraftedPlan,
  type Language,
  type LessonPlanId,
  type PlanTemplate,
  type PlanTemplateId,
  type Result,
  type StarterTemplate,
  type User,
} from '@thp/domain';
import type { Clock, IdGenerator, LessonPlanRepository, PlanTemplateRepository } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findPlan } from './plan-access.ts';

export interface TemplateList {
  /** The starter featured this week. */
  readonly featured: StarterTemplate;
  readonly starters: readonly StarterTemplate[];
  /** The actor's own templates by name. */
  readonly own: readonly PlanTemplate[];
}

export class ListTemplates {
  constructor(
    private readonly deps: {
      readonly planTemplates: PlanTemplateRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: { actor: User }): Promise<TemplateList> {
    const own = await this.deps.planTemplates.listByTeacher(input.actor.schoolId, input.actor.id);
    return {
      featured: templateOfTheWeek(this.deps.clock.now()),
      starters: starterTemplates,
      own: [...own].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }
}

/** Saves one of the actor's plans as a template. */
export class SaveAsTemplate {
  constructor(
    private readonly deps: {
      readonly lessonPlans: LessonPlanRepository;
      readonly planTemplates: PlanTemplateRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    actor: User;
    planId: LessonPlanId;
    name: string;
  }): Promise<Result<PlanTemplate, UseCaseError>> {
    const plan = await findPlan(this.deps.lessonPlans, input.actor, input.planId);
    if (!plan.ok) return plan;
    const template = templateFromPlan(
      { ...plan.value, teacherId: input.actor.id },
      this.deps.ids.next() as PlanTemplateId,
      input.name,
    );
    if (template.ok) await this.deps.planTemplates.save(template.value);
    return template;
  }
}

async function findOwnTemplate(
  templates: PlanTemplateRepository,
  actor: User,
  templateId: PlanTemplateId,
): Promise<Result<PlanTemplate, UseCaseError>> {
  const template = await templates.findById(actor.schoolId, templateId);
  return template?.teacherId === actor.id ? ok(template) : fail('not_found');
}

export class DeleteTemplate {
  constructor(private readonly deps: { readonly planTemplates: PlanTemplateRepository }) {}

  async execute(input: {
    actor: User;
    templateId: PlanTemplateId;
  }): Promise<Result<true, UseCaseError>> {
    const found = await findOwnTemplate(this.deps.planTemplates, input.actor, input.templateId);
    if (!found.ok) return found;
    await this.deps.planTemplates.delete(found.value.schoolId, found.value.id);
    return ok(true);
  }
}

export type TemplateSource =
  { readonly starterId: string } | { readonly templateId: PlanTemplateId };

/** A new plan's content from a starter or one of the actor's templates, moved to `start`. */
export class StartFromTemplate {
  constructor(private readonly deps: { readonly planTemplates: PlanTemplateRepository }) {}

  async execute(input: {
    actor: User;
    source: TemplateSource;
    start: string;
    language: Language;
  }): Promise<Result<DraftedPlan, UseCaseError>> {
    const start = parseLocalDate('start', input.start);
    if (!start.ok) return start;
    if ('starterId' in input.source) {
      const starter = findStarter(input.source.starterId);
      return starter
        ? ok({ title: null, body: starterBody(starter, input.language, start.value) })
        : fail('not_found');
    }
    const template = await findOwnTemplate(
      this.deps.planTemplates,
      input.actor,
      input.source.templateId,
    );
    if (!template.ok) return template;
    return ok({
      title: template.value.title,
      body: movePlanBody(template.value.body, start.value),
    });
  }
}
