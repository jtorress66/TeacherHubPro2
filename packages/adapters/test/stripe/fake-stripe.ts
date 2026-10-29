import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStripeClient } from '../../src/billing/stripe-client.ts';

/** A recorded Stripe API response, from `test/stripe/recorded/`. */
export const recorded = (name: string): unknown =>
  JSON.parse(
    readFileSync(join(import.meta.dirname, 'recorded', `${name}.json`), 'utf8'),
  ) as unknown;

export interface StripeRequest {
  readonly method: string;
  readonly path: string;
  /** Query string for GET, form body for POST. */
  readonly params: URLSearchParams;
}

export interface StripeReply {
  readonly status?: number;
  readonly body: unknown;
}

export type Route = (request: StripeRequest) => StripeReply | undefined;

/** A Stripe client whose HTTP calls are answered by `routes` instead of the network. */
export function fakeStripe(routes: readonly Route[]) {
  const requests: StripeRequest[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const params =
      method === 'GET'
        ? url.searchParams
        : new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
    const request = { method, path: url.pathname, params };
    requests.push(request);
    const reply = routes.map((route) => route(request)).find((r) => r !== undefined);
    const { status = 200, body } = reply ?? {
      status: 404,
      body: {
        error: { type: 'invalid_request_error', message: `No route for ${method} ${url.pathname}` },
      },
    };
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { stripe: createStripeClient('sk_test_recorded', fetchFn), requests };
}

export const on =
  (
    method: string,
    path: string,
    reply: StripeReply | ((request: StripeRequest) => StripeReply),
  ): Route =>
  (request) =>
    request.method === method && request.path === path
      ? typeof reply === 'function'
        ? reply(request)
        : reply
      : undefined;
