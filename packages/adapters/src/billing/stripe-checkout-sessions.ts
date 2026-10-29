import Stripe from 'stripe';
import { err, ok, type Result } from '@thp/domain';
import type { BillingError, CheckoutRequest, CheckoutSession, CheckoutSessions } from '@thp/ports';
import { stripePriceFor } from './stripe-plans.ts';

/** Stripe only accepts a trial end at least 48 hours away. */
const minimumTrialMs = 48 * 60 * 60 * 1000;

/** Stripe-hosted Checkout for a subscription, tagged with our ids so webhooks can find it. */
export class StripeCheckoutSessions implements CheckoutSessions {
  constructor(
    private readonly stripe: Stripe,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createCheckout(request: CheckoutRequest): Promise<Result<CheckoutSession, BillingError>> {
    try {
      const prices = await this.stripe.prices.list({
        lookup_keys: [stripePriceFor(request.planId).lookupKey],
        active: true,
        limit: 1,
      });
      const price = prices.data[0];
      if (price === undefined) return err({ code: 'invalid_request' });

      const metadata = {
        schoolId: request.schoolId,
        subscriptionId: request.clientReference,
        planId: request.planId,
        quantity: String(request.quantity),
      };
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: price.id, quantity: request.quantity }],
        customer_email: request.customerEmail,
        client_reference_id: request.clientReference,
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
        metadata,
        subscription_data: { metadata, ...this.trialEnd(request.trialEnd) },
      });
      return session.url
        ? ok({ sessionId: session.id, url: session.url })
        : err({ code: 'unavailable' });
    } catch (error) {
      return err({
        code:
          error instanceof Stripe.errors.StripeInvalidRequestError
            ? 'invalid_request'
            : 'unavailable',
      });
    }
  }

  private trialEnd(end: Date | null): { trial_end?: number } {
    if (end === null || end.getTime() - this.now().getTime() < minimumTrialMs) return {};
    return { trial_end: Math.floor(end.getTime() / 1000) };
  }
}
