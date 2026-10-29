import type { SchoolId, SubscriptionId, UserId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { planCatalog, trialDays, type PlanId } from './plan-catalog.ts';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

export type SubscriptionAction = 'activate' | 'mark_past_due' | 'cancel' | 'expire_trial';

export type SubscriptionError =
  InvalidTransition<SubscriptionStatus, SubscriptionAction> | { readonly code: 'trial_not_over' };

export interface Subscription {
  readonly id: SubscriptionId;
  readonly schoolId: SchoolId;
  readonly ownerId: UserId;
  readonly planId: PlanId;
  /** Seats: 1 for individual plans, the number of teachers for school and district plans. */
  readonly quantity: number;
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date;
  readonly currentPeriodEnd: Date | null;
  /** The payment provider's subscription id, once checkout completes. */
  readonly externalId: string | null;
}

export interface TrialInput {
  readonly id: SubscriptionId;
  readonly schoolId: SchoolId;
  readonly ownerId: UserId;
  readonly planId: PlanId;
  readonly quantity?: number;
  readonly now: Date;
}

const transitions: TransitionTable<SubscriptionStatus, SubscriptionAction> = {
  activate: ['trialing', 'past_due'],
  mark_past_due: ['active'],
  cancel: ['trialing', 'active', 'past_due'],
  expire_trial: ['trialing'],
};

const dayMs = 24 * 60 * 60 * 1000;

function validQuantity(planId: PlanId, quantity: number): boolean {
  if (planCatalog[planId].unit === 'account') return quantity === 1;
  return Number.isInteger(quantity) && quantity >= 1;
}

export function startTrial(input: TrialInput): Result<Subscription, ValidationError> {
  const quantity = input.quantity ?? 1;
  if (!validQuantity(input.planId, quantity)) return invalid('quantity', 'out_of_range');
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    ownerId: input.ownerId,
    planId: input.planId,
    quantity,
    status: 'trialing',
    trialEndsAt: new Date(input.now.getTime() + trialDays * dayMs),
    currentPeriodEnd: null,
    externalId: null,
  });
}

export function activateSubscription(
  subscription: Subscription,
  payment: { readonly currentPeriodEnd: Date; readonly externalId?: string },
): Result<Subscription, SubscriptionError> {
  const allowed = guardTransition(transitions, subscription.status, 'activate');
  if (!allowed.ok) return allowed;
  return ok({
    ...subscription,
    status: 'active',
    currentPeriodEnd: payment.currentPeriodEnd,
    externalId: payment.externalId ?? subscription.externalId,
  });
}

export function markPastDue(subscription: Subscription): Result<Subscription, SubscriptionError> {
  const allowed = guardTransition(transitions, subscription.status, 'mark_past_due');
  if (!allowed.ok) return allowed;
  return ok({ ...subscription, status: 'past_due' });
}

export function cancelSubscription(
  subscription: Subscription,
): Result<Subscription, SubscriptionError> {
  const allowed = guardTransition(transitions, subscription.status, 'cancel');
  if (!allowed.ok) return allowed;
  return ok({ ...subscription, status: 'canceled' });
}

export function expireTrial(
  subscription: Subscription,
  now: Date,
): Result<Subscription, SubscriptionError> {
  const allowed = guardTransition(transitions, subscription.status, 'expire_trial');
  if (!allowed.ok) return allowed;
  if (now < subscription.trialEndsAt) return err({ code: 'trial_not_over' });
  return ok({ ...subscription, status: 'expired' });
}

/** Trials give access until they end; past-due keeps access while payment is retried. */
export function hasAccess(subscription: Subscription, now: Date): boolean {
  if (subscription.status === 'trialing') return now < subscription.trialEndsAt;
  return subscription.status === 'active' || subscription.status === 'past_due';
}
