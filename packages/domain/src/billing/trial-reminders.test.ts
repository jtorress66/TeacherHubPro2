import { describe, expect, it } from 'vitest';
import type { SchoolId, SubscriptionId, UserId } from '../shared/ids.ts';
import type { Subscription } from './subscription.ts';
import { reminderDue } from './trial-reminders.ts';

const ends = new Date('2026-11-10T12:00:00Z');
const trial: Subscription = {
  id: 'sub-1' as SubscriptionId,
  schoolId: 'school-1' as SchoolId,
  ownerId: 'teacher-1' as UserId,
  planId: 'individual_monthly',
  quantity: 1,
  status: 'trialing',
  trialEndsAt: ends,
  currentPeriodEnd: null,
  externalId: null,
};
const daysBefore = (days: number) => new Date(ends.getTime() - days * 24 * 60 * 60 * 1000);

describe('reminderDue', () => {
  it('reminds 3 days before the trial ends, then on its last day', () => {
    expect(reminderDue(trial, daysBefore(4), [])).toBeNull();
    expect(reminderDue(trial, daysBefore(3), [])).toBe('three_days');
    expect(reminderDue(trial, daysBefore(2), [])).toBe('three_days');
    expect(reminderDue(trial, daysBefore(1), [])).toBe('last_day');
    expect(reminderDue(trial, daysBefore(0.25), [])).toBe('last_day');
  });

  it('never sends a reminder twice, and skips the 3-day one if the last day has come', () => {
    expect(reminderDue(trial, daysBefore(2), ['three_days'])).toBeNull();
    expect(reminderDue(trial, daysBefore(1), ['three_days'])).toBe('last_day');
    expect(reminderDue(trial, daysBefore(0.5), [])).toBe('last_day');
    expect(reminderDue(trial, daysBefore(0.5), ['three_days', 'last_day'])).toBeNull();
  });

  it('stays quiet once the trial is over or paid for', () => {
    expect(reminderDue(trial, daysBefore(-1), [])).toBeNull();
    expect(reminderDue({ ...trial, status: 'active' }, daysBefore(1), [])).toBeNull();
  });
});
