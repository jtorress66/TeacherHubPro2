import type { Subscription } from './subscription.ts';

export const trialReminderKinds = ['three_days', 'last_day'] as const;

export type TrialReminderKind = (typeof trialReminderKinds)[number];

const dayMs = 24 * 60 * 60 * 1000;

/** The window (in days before the trial ends) when each reminder goes out, latest first. */
const windows: readonly { readonly kind: TrialReminderKind; readonly withinDays: number }[] = [
  { kind: 'last_day', withinDays: 1 },
  { kind: 'three_days', withinDays: 3 },
];

/**
 * The reminder a trialing school should get now, if any: one 3 days before the trial ends and
 * one on its last day, each at most once. Paid or ended trials get none.
 */
export function reminderDue(
  subscription: Subscription,
  now: Date,
  sent: readonly TrialReminderKind[],
): TrialReminderKind | null {
  const left = subscription.trialEndsAt.getTime() - now.getTime();
  if (subscription.status !== 'trialing' || left <= 0) return null;
  const window = windows.find((w) => left <= w.withinDays * dayMs);
  // The windows are checked latest first, so once the last day comes the 3-day one is skipped.
  if (window === undefined || sent.includes(window.kind)) return null;
  return window.kind;
}
