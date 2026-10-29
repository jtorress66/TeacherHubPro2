import type { SchoolId, SubscriptionId, UserId } from '../shared/ids.ts';
import { err, ok, type Result } from '../shared/result.ts';
import {
  guardTransition,
  type InvalidTransition,
  type TransitionTable,
} from '../shared/state-machine.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { isValidQuantity, planCatalog, trialDays, type PlanId } from './plan-catalog.ts';

export const subscriptionStatuses = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
] as const;

export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export type SubscriptionAction = 'activate' | 'renew' | 'mark_past_due' | 'cancel' | 'expire_trial';

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
  renew: ['active', 'past_due'],
  mark_past_due: ['active'],
  cancel: ['trialing', 'active', 'past_due'],
  expire_trial: ['trialing'],
};

const dayMs = 24 * 60 * 60 * 1000;

export function startTrial(input: TrialInput): Result<Subscription, ValidationError> {
  const quantity = input.quantity ?? 1;
  if (!isValidQuantity(input.planId, quantity)) return invalid('quantity', 'out_of_range');
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

export interface Payment {
  readonly currentPeriodEnd: Date;
  readonly externalId?: string;
  /** The plan and seats bought at checkout; the current ones are kept when omitted. */
  readonly planId?: PlanId;
  readonly quantity?: number;
}

export function activateSubscription(
  subscription: Subscription,
  payment: Payment,
): Result<Subscription, SubscriptionError | ValidationError> {
  const allowed = guardTransition(transitions, subscription.status, 'activate');
  if (!allowed.ok) return allowed;
  const planId = payment.planId ?? subscription.planId;
  const quantity = payment.quantity ?? subscription.quantity;
  if (!isValidQuantity(planId, quantity)) return invalid('quantity', 'out_of_range');
  return ok({
    ...subscription,
    planId,
    quantity,
    status: 'active',
    currentPeriodEnd: payment.currentPeriodEnd,
    externalId: payment.externalId ?? subscription.externalId,
  });
}

/** A paid period renewed: the subscription is active until the new period end. */
export function renewSubscription(
  subscription: Subscription,
  currentPeriodEnd: Date,
): Result<Subscription, SubscriptionError> {
  const allowed = guardTransition(transitions, subscription.status, 'renew');
  if (!allowed.ok) return allowed;
  return ok({ ...subscription, status: 'active', currentPeriodEnd });
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

/** Whole days left in a trial, rounded up (0 once it has ended); null when not on a trial. */
export function trialDaysLeft(subscription: Subscription, now: Date): number | null {
  if (subscription.status !== 'trialing') return null;
  const left = subscription.trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(left / dayMs));
}

/** How many teachers the subscription covers: one on individual plans, the bought seats otherwise. */
export function seatLimit(subscription: Subscription): number {
  return planCatalog[subscription.planId].unit === 'account' ? 1 : subscription.quantity;
}
