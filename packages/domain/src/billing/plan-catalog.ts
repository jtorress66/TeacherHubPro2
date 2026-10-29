/**
 * The plans and prices. The single source of truth for pricing pages, checkout and
 * the marketing chatbot (which must never invent prices).
 */
export const planIds = ['individual_monthly', 'individual_yearly', 'school', 'district'] as const;

export type PlanId = (typeof planIds)[number];

export type Period = 'month' | 'year';

export interface Plan {
  readonly id: PlanId;
  /** Price in US cents for one `unit` per `pricePer`. */
  readonly priceCents: number;
  readonly unit: 'account' | 'teacher';
  readonly pricePer: Period;
  readonly billedEvery: Period;
}

export const trialDays = 7;

export const planCatalog: Readonly<Record<PlanId, Plan>> = {
  individual_monthly: {
    id: 'individual_monthly',
    priceCents: 999,
    unit: 'account',
    pricePer: 'month',
    billedEvery: 'month',
  },
  individual_yearly: {
    id: 'individual_yearly',
    priceCents: 7900,
    unit: 'account',
    pricePer: 'year',
    billedEvery: 'year',
  },
  school: {
    id: 'school',
    priceCents: 600,
    unit: 'teacher',
    pricePer: 'month',
    billedEvery: 'year',
  },
  district: {
    id: 'district',
    priceCents: 400,
    unit: 'teacher',
    pricePer: 'month',
    billedEvery: 'year',
  },
};

const monthsIn: Readonly<Record<Period, number>> = { month: 1, year: 12 };

/** What one invoice costs, in cents, for `quantity` units. */
export function chargePerBillingPeriodCents(planId: PlanId, quantity: number): number {
  const plan = planCatalog[planId];
  return (plan.priceCents * quantity * monthsIn[plan.billedEvery]) / monthsIn[plan.pricePer];
}
