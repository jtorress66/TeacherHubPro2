import {
  completeOnboarding,
  dismissOnboarding,
  onboardingApplies,
  type School,
  type User,
} from '@thp/domain';
import type { ClassRepository, UserRepository } from '@thp/ports';

export interface OnboardingContext {
  readonly user: User;
  readonly school: School;
  readonly classes: ClassRepository;
  /** "My School" in every language: a school still called that has not been set up. */
  readonly defaultSchoolNames: readonly string[];
}

/** One thing a new teacher sets up. Later steps add items by registering more of these. */
export interface OnboardingItem {
  readonly id: string;
  /** An i18n message key for the label. */
  readonly labelKey: string;
  /** Where to go to do it, without the language prefix. */
  readonly route: string;
  readonly isDone: (context: OnboardingContext) => Promise<boolean>;
}

export const schoolInfoItem: OnboardingItem = {
  id: 'school_info',
  labelKey: 'onboarding.schoolInfo',
  route: '/app/settings',
  isDone: ({ school, defaultSchoolNames }) =>
    Promise.resolve(!defaultSchoolNames.includes(school.name)),
};

export const firstClassItem: OnboardingItem = {
  id: 'first_class',
  labelKey: 'onboarding.firstClass',
  route: '/app/classes',
  isDone: async ({ user, school, classes }) =>
    (await classes.listByTeacher(school.id, user.id, { includeArchived: true })).length > 0,
};

export const defaultOnboardingItems: readonly OnboardingItem[] = [schoolInfoItem, firstClassItem];

export interface OnboardingState {
  readonly show: boolean;
  readonly done: number;
  readonly total: number;
  readonly items: readonly {
    readonly id: string;
    readonly labelKey: string;
    readonly route: string;
    readonly done: boolean;
  }[];
}

/** The setup checklist; it completes itself once everything is done. */
export class GetOnboarding {
  constructor(
    private readonly deps: {
      readonly users: UserRepository;
      readonly classes: ClassRepository;
      readonly items: readonly OnboardingItem[];
      readonly defaultSchoolNames: readonly string[];
    },
  ) {}

  async execute(input: { actor: User; school: School }): Promise<OnboardingState> {
    const context = { user: input.actor, school: input.school, ...this.deps };
    const items = await Promise.all(
      this.deps.items.map(async ({ id, labelKey, route, isDone }) => ({
        id,
        labelKey,
        route,
        done: await isDone(context),
      })),
    );
    const done = items.filter((item) => item.done).length;
    const status = input.actor.onboardingStatus;
    const open = onboardingApplies(input.actor) && status !== 'dismissed' && status !== 'completed';
    if (open && done === items.length) await this.deps.users.save(completeOnboarding(input.actor));
    return { show: open && done < items.length, done, total: items.length, items };
  }
}

export class DismissOnboarding {
  constructor(private readonly deps: { readonly users: UserRepository }) {}

  async execute(input: { actor: User }): Promise<User> {
    const dismissed = dismissOnboarding(input.actor);
    await this.deps.users.save(dismissed);
    return dismissed;
  }
}
