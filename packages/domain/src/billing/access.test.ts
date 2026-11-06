import { describe, expect, it } from 'vitest';
import type { SchoolId, SubscriptionId, UserId } from '../shared/ids.ts';
import { accessFor } from './access.ts';
import { startTrial, type Subscription } from './subscription.ts';

const started = new Date('2026-11-01T00:00:00Z');
const trial = startTrial({
  id: 'sub1' as SubscriptionId,
  schoolId: 's1' as SchoolId,
  ownerId: 'u1' as UserId,
  planId: 'individual_monthly',
  now: started,
});
if (!trial.ok) throw new Error('trial');
const subscription: Subscription = trial.value;
const during = new Date('2026-11-04T00:00:00Z');
const after = new Date('2026-12-01T00:00:00Z');

describe('accessFor', () => {
  it('always gives a super admin full access, with or without a plan', () => {
    const owner = { role: 'super_admin' as const };
    const full = { hasAccess: true, trialDaysLeft: null, owner: true };
    expect(accessFor(owner, subscription, after)).toEqual(full);
    expect(accessFor(owner, null, after)).toEqual(full);
  });

  it("follows the school's trial or plan for everyone else", () => {
    for (const role of ['teacher', 'school_admin'] as const) {
      expect(accessFor({ role }, subscription, during)).toEqual({
        hasAccess: true,
        trialDaysLeft: 4,
        owner: false,
      });
      expect(accessFor({ role }, subscription, after)).toEqual({
        hasAccess: false,
        trialDaysLeft: 0,
        owner: false,
      });
      expect(accessFor({ role }, null, during)).toEqual({
        hasAccess: false,
        trialDaysLeft: null,
        owner: false,
      });
    }
  });
});
