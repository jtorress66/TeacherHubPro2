import type { Metadata } from 'next';
import { planCatalog, planIds } from '@thp/domain';
import { createTranslator, type MessageKey } from '@thp/i18n';
import { UpgradeForm } from '../../../../components/forms.tsx';
import { planBadge, planName, planPrice } from '../../../../server/plan-display.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('billing.title') };
}

const checkoutMessages: Readonly<Record<string, { key: MessageKey; role: 'status' | 'alert' }>> = {
  success: { key: 'billing.checkoutSuccess', role: 'status' },
  canceled: { key: 'billing.checkoutCanceled', role: 'status' },
  unavailable: { key: 'billing.checkoutUnavailable', role: 'alert' },
};

export default async function BillingPage(
  props: LocaleParams & { readonly searchParams: Promise<{ checkout?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { subscription, access } = await requireUser(locale, { needsAccess: false });
  const { checkout } = await props.searchParams;
  const message = checkout === undefined ? undefined : checkoutMessages[checkout];
  const trialing = subscription?.status === 'trialing';

  return (
    <section className="stack">
      <h1>{t('billing.title')}</h1>
      {message ? (
        <p role={message.role} className={message.role === 'alert' ? 'alert' : 'notice'}>
          {t(message.key)}
        </p>
      ) : null}
      {trialing && access.hasAccess ? (
        <p>{t('billing.onTrial', { days: access.trialDaysLeft ?? 0 })}</p>
      ) : null}
      {trialing && !access.hasAccess ? (
        <p role="alert" className="alert">
          {t('billing.trialEnded')}
        </p>
      ) : null}
      {subscription && !trialing ? (
        <p data-testid="current-plan">
          {t('billing.currentPlan', { plan: planBadge(subscription, access, locale) })}
        </p>
      ) : null}

      {trialing ? (
        <>
          {access.hasAccess ? <p className="muted">{t('billing.freeDaysKept')}</p> : null}
          <ul className="plan-grid">
            {planIds.map((planId) => {
              const plan = planCatalog[planId];
              const name = planName(planId, locale);
              return (
                <li key={planId} className="card stack">
                  <h2>{name}</h2>
                  <p>{planPrice(planId, locale)}</p>
                  {plan.unit === 'teacher' ? (
                    <p className="muted">
                      {t('plans.minimumTeachers', { count: plan.minimumSeats })}
                    </p>
                  ) : null}
                  <UpgradeForm
                    locale={locale}
                    planId={planId}
                    planName={name}
                    minimumSeats={plan.unit === 'teacher' ? plan.minimumSeats : null}
                  />
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
