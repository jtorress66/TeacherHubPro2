import {
  createSchool,
  createUser,
  defaultLanguage,
  isLanguage,
  ok,
  startTrial,
  type Email,
  type Result,
  type School,
  type SchoolId,
  type Subscription,
  type SubscriptionId,
  type User,
  type UserId,
  type ValidationError,
} from '@thp/domain';
import type {
  Clock,
  IdGenerator,
  ReferralRepository,
  SchoolRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { recordReferral } from '../referrals/referrals.ts';

export interface AccountCreatorDeps {
  readonly users: UserRepository;
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly referrals: ReferralRepository;
}

export interface NewAccount {
  readonly email: Email;
  readonly name: string;
  /** The language of the page the teacher signed up on. */
  readonly language: string;
  readonly picture: string | null;
  /** "My School" in the teacher's language. */
  readonly defaultSchoolName: string;
  /** Set when the address is already known to work (Google verified it); null otherwise. */
  readonly emailConfirmedAt: Date | null;
  /** The invite code from the link the teacher came through, if any. */
  readonly referralCode?: string | null | undefined;
}

export interface Account {
  readonly user: User;
  readonly school: School;
  readonly subscription: Subscription;
}

/** A new teacher always gets their own school and a 7-day trial, and is never given another role. */
export class AccountCreator {
  constructor(private readonly deps: AccountCreatorDeps) {}

  async create(input: NewAccount): Promise<Result<Account, ValidationError>> {
    const school = createSchool({
      id: this.deps.ids.next() as SchoolId,
      name: input.defaultSchoolName,
    });
    if (!school.ok) return school;
    const user = createUser({
      id: this.deps.ids.next() as UserId,
      schoolId: school.value.id,
      email: input.email,
      name: input.name,
      role: 'teacher',
      language: isLanguage(input.language) ? input.language : defaultLanguage,
      picture: input.picture,
      emailConfirmedAt: input.emailConfirmedAt,
    });
    if (!user.ok) return user;
    const subscription = startTrial({
      id: this.deps.ids.next() as SubscriptionId,
      schoolId: school.value.id,
      ownerId: user.value.id,
      planId: 'individual_monthly',
      now: this.deps.clock.now(),
    });
    if (!subscription.ok) return subscription;

    await this.deps.schools.save(school.value);
    await this.deps.users.save(user.value);
    await this.deps.subscriptions.save(subscription.value);
    await recordReferral(this.deps, input.referralCode, school.value.id);
    return ok({ user: user.value, school: school.value, subscription: subscription.value });
  }
}
