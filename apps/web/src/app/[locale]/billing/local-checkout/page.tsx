import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidQuantity, planIds, type PlanId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { planName, totalPrice } from '../../../../server/plan-display.ts';
import { payLocalCheckoutAction } from '../../../_lib/actions.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Test checkout — TeacherHubPro' };

const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && (planIds as readonly string[]).includes(value);

interface CheckoutParams {
  readonly plan?: string;
  readonly quantity?: string;
  readonly subscription?: string;
  readonly success?: string;
  readonly cancel?: string;
}

/** Stand-in for a hosted checkout, available only with BILLING_PROVIDER=local. */
export default async function LocalCheckoutPage(
  props: LocaleParams & { readonly searchParams: Promise<CheckoutParams> },
) {
  const locale = await localeFrom(props);
  if (!getAppContainer().localCheckout) notFound();
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const params = await props.searchParams;
  const quantity = Number(params.quantity ?? '1');
  if (!isPlanId(params.plan) || !isValidQuantity(params.plan, quantity)) notFound();
  const name = planName(params.plan, locale);
  const total = totalPrice(params.plan, quantity, locale);
  const cancel = params.cancel?.startsWith(`${getAppContainer().appUrl}/`)
    ? params.cancel
    : `/${locale}/app/billing`;

  return (
    <main className="auth">
      <section className="card stack checkout">
        <p className="test-banner">{t('checkout.testMode')}</p>
        <h1>{t('checkout.title', { plan: name })}</h1>
        <p className="price">{t('checkout.total', { price: total })}</p>
        <p className="muted">{t('checkout.billedTo', { email: user.email })}</p>
        <form action={payLocalCheckoutAction} className="stack">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="plan" value={params.plan} />
          <input type="hidden" name="quantity" value={String(quantity)} />
          <input type="hidden" name="subscription" value={params.subscription ?? ''} />
          <input type="hidden" name="success" value={params.success ?? ''} />
          <button type="submit" className="button">
            {t('checkout.pay', { price: total })}
          </button>
        </form>
        <a href={cancel}>{t('checkout.cancel')}</a>
      </section>
    </main>
  );
}
