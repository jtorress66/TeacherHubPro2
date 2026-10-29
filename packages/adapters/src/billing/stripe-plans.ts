import { chargePerBillingPeriodCents, planCatalog, type Period, type PlanId } from '@thp/domain';

/** Stripe finds our prices by these lookup keys, so price ids never live in configuration. */
const lookupKeys: Readonly<Record<PlanId, string>> = {
  individual_monthly: 'thp_individual_monthly',
  individual_yearly: 'thp_individual_yearly',
  school: 'thp_school_seat_yearly',
  district: 'thp_district_seat_yearly',
};

const productNames: Readonly<Record<PlanId, string>> = {
  individual_monthly: 'TeacherHubPro Individual (monthly)',
  individual_yearly: 'TeacherHubPro Individual (yearly)',
  school: 'TeacherHubPro School (per teacher, yearly)',
  district: 'TeacherHubPro District (per teacher, yearly)',
};

export interface StripePrice {
  readonly lookupKey: string;
  readonly productName: string;
  /** Cents per billing period for one seat. */
  readonly unitAmount: number;
  readonly interval: Period;
}

/** The Stripe price for a plan, derived from the plan catalog (the single source of prices). */
export function stripePriceFor(planId: PlanId): StripePrice {
  return {
    lookupKey: lookupKeys[planId],
    productName: productNames[planId],
    unitAmount: chargePerBillingPeriodCents(planId, 1),
    interval: planCatalog[planId].billedEvery,
  };
}
