import type Stripe from 'stripe';
import { err, ok, planIds, type PlanId, type Result } from '@thp/domain';
import { stripePriceFor } from './stripe-plans.ts';

export interface EnsuredPrice {
  readonly planId: PlanId;
  readonly priceId: string;
  /** False when the price already existed. */
  readonly created: boolean;
}

/**
 * Creates the product and price for every plan that Stripe does not have yet (found by lookup
 * key). Safe to run again: existing prices are left alone. Run by `pnpm stripe:setup`.
 */
export async function ensureStripePrices(stripe: Stripe): Promise<Result<EnsuredPrice[], string>> {
  const ensured: EnsuredPrice[] = [];
  try {
    for (const planId of planIds) {
      const spec = stripePriceFor(planId);
      const existing = await stripe.prices.list({
        lookup_keys: [spec.lookupKey],
        active: true,
        limit: 1,
      });
      const found = existing.data[0];
      if (found !== undefined) {
        ensured.push({ planId, priceId: found.id, created: false });
        continue;
      }
      const product = await stripe.products.create({ name: spec.productName });
      const price = await stripe.prices.create({
        product: product.id,
        lookup_key: spec.lookupKey,
        currency: 'usd',
        unit_amount: spec.unitAmount,
        recurring: { interval: spec.interval },
      });
      ensured.push({ planId, priceId: price.id, created: true });
    }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Stripe setup failed');
  }
  return ok(ensured);
}
