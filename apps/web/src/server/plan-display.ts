import {
  chargePerBillingPeriodCents,
  planCatalog,
  type Access,
  type PlanId,
  type Subscription,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/**
 * Prices follow each language's usual style, except Spanish: our Spanish readers are in Puerto
 * Rico and the US, who write $9.99, not Spain's 9,99 US$.
 */
const moneyLocales: Partial<Record<Locale, string>> = { es: 'es-PR' };

const money = (cents: number, locale: Locale): string =>
  new Intl.NumberFormat(moneyLocales[locale] ?? locale, {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

/** "$9.99 per month", "$6.00 per teacher per month, billed yearly", in the page language. */
export function planPrice(planId: PlanId, locale: Locale): string {
  const t = createTranslator(locale);
  const plan = planCatalog[planId];
  const price = money(plan.priceCents, locale);
  if (plan.unit === 'teacher') return t('plans.perTeacherPerMonth', { price });
  return plan.pricePer === 'month' ? t('plans.perMonth', { price }) : t('plans.perYear', { price });
}

/** What one invoice costs for the seats chosen. */
export const totalPrice = (planId: PlanId, quantity: number, locale: Locale): string =>
  money(chargePerBillingPeriodCents(planId, quantity), locale);

export const planName = (planId: PlanId, locale: Locale): string =>
  createTranslator(locale)(`plans.${planId}`);

/** The short plan label on the dashboard. */
export function planBadge(
  subscription: Subscription | null,
  access: Access,
  locale: Locale,
): string {
  const t = createTranslator(locale);
  if (access.owner) return t('dashboard.ownerAccess');
  if (subscription === null) return '';
  if (subscription.status === 'trialing') {
    const days = access.trialDaysLeft ?? 0;
    if (days === 0) return t('plans.freeTrial');
    return days === 1 ? t('dashboard.trialLastDay') : t('dashboard.trialDaysLeft', { days });
  }
  const name = planName(subscription.planId, locale);
  return planCatalog[subscription.planId].unit === 'teacher'
    ? t('plans.seats', { plan: name, count: subscription.quantity })
    : name;
}

/** How much less the yearly plan costs than twelve months of the monthly one, in whole percent. */
export function yearlySavingPercent(): number {
  const monthly = planCatalog.individual_monthly.priceCents * 12;
  return Math.floor((1 - planCatalog.individual_yearly.priceCents / monthly) * 100);
}
