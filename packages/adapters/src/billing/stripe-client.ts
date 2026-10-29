import Stripe from 'stripe';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * The official Stripe client. Tests pass a `fetch` that answers with recorded responses.
 * No automatic retries: webhooks and the teacher's next click are the retry.
 */
export function createStripeClient(secretKey: string, fetchFn?: Fetch): Stripe {
  return new Stripe(secretKey, {
    maxNetworkRetries: 0,
    telemetry: false,
    ...(fetchFn === undefined ? {} : { httpClient: Stripe.createFetchHttpClient(fetchFn) }),
  });
}
