import {
  hasAccess,
  isSessionActive,
  ok,
  trialDaysLeft,
  type Result,
  type School,
  type Subscription,
  type User,
} from '@thp/domain';
import type {
  Clock,
  SchoolRepository,
  SessionRepository,
  SubscriptionRepository,
  TokenHasher,
  UserRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findSchoolSubscription } from './school-subscription.ts';

export interface AuthenticateSessionDeps {
  readonly sessions: SessionRepository;
  readonly tokenHasher: TokenHasher;
  readonly users: UserRepository;
  readonly schools: SchoolRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly clock: Clock;
}

export interface Access {
  readonly hasAccess: boolean;
  /** Days left in the free trial; null when not on a trial. */
  readonly trialDaysLeft: number | null;
}

export interface Authenticated {
  readonly user: User;
  readonly school: School;
  readonly subscription: Subscription | null;
  readonly access: Access;
}

/** Turns a session token into the signed-in teacher, their school and whether they may use the app. */
export class AuthenticateSession {
  constructor(private readonly deps: AuthenticateSessionDeps) {}

  async execute(sessionToken: string): Promise<Result<Authenticated, UseCaseError>> {
    const tokenHash = await this.deps.tokenHasher.hash(sessionToken);
    const session = await this.deps.sessions.findByTokenHash(tokenHash);
    if (!session) return fail('unauthenticated');
    const now = this.deps.clock.now();
    if (!isSessionActive(session, now)) {
      await this.deps.sessions.delete(tokenHash);
      return fail('session_expired');
    }
    const user = await this.deps.users.findById(session.schoolId, session.userId);
    const school = await this.deps.schools.findById(session.schoolId);
    if (!user || !school) return fail('unauthenticated');

    const subscription = await findSchoolSubscription(this.deps.subscriptions, school.id);
    const access: Access = subscription
      ? { hasAccess: hasAccess(subscription, now), trialDaysLeft: trialDaysLeft(subscription, now) }
      : { hasAccess: false, trialDaysLeft: null };
    return ok({ user, school, subscription, access });
  }
}
