import { describe, expect, it } from 'vitest';
import type { Email, SubscriptionId } from '@thp/domain';
import type {
  BillingEvent,
  BillingEvents,
  CheckoutSessions,
  LlmClient,
  LlmError,
  Mailer,
  TextToSpeech,
  TextToSpeechError,
} from '@thp/ports';

/**
 * Contracts for ports backed by external services. Fakes run them now; real adapters run
 * them against recorded HTTP responses (MSW) in later steps.
 */

export function llmClientContract(
  name: string,
  setup: {
    readonly replying: (text: string) => LlmClient;
    readonly failing: (code: LlmError['code']) => LlmClient;
  },
): void {
  describe(`${name} (LlmClient contract)`, () => {
    const request = {
      system: 'You are a test.',
      messages: [{ role: 'user' as const, content: 'Hi' }],
      maxTokens: 50,
    };

    it('returns the model text', async () => {
      const result = await setup.replying('Hello!').complete(request);
      expect(result.ok && result.value.text).toBe('Hello!');
    });

    it.each(['rate_limited', 'unavailable', 'invalid_request', 'refused'] as const)(
      'maps a %s failure to a typed error',
      async (code) => {
        expect(await setup.failing(code).complete(request)).toEqual({ ok: false, error: { code } });
      },
    );
  });
}

export function textToSpeechContract(
  name: string,
  setup: {
    readonly working: () => TextToSpeech;
    readonly failing: (code: TextToSpeechError['code']) => TextToSpeech;
  },
): void {
  describe(`${name} (TextToSpeech contract)`, () => {
    const request = { text: 'Hola clase', voice: 'alloy', language: 'es' as const };

    it('returns audio with a mime type', async () => {
      const result = await setup.working().synthesize(request);
      expect(
        result.ok && result.value.audio.length > 0 && result.value.mimeType.startsWith('audio/'),
      ).toBe(true);
    });

    it('maps failures to typed errors', async () => {
      expect(await setup.failing('unavailable').synthesize(request)).toEqual({
        ok: false,
        error: { code: 'unavailable' },
      });
    });
  });
}

export function mailerContract(
  name: string,
  setup: { readonly accepting: () => Mailer; readonly rejecting: () => Mailer },
): void {
  describe(`${name} (Mailer contract)`, () => {
    const message = {
      to: 'parent@mail.com' as Email,
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    };

    it('returns a message id when accepted', async () => {
      const result = await setup.accepting().send(message);
      expect(result.ok && result.value.messageId.length > 0).toBe(true);
    });

    it('reports a rejected message', async () => {
      expect(await setup.rejecting().send(message)).toEqual({
        ok: false,
        error: { code: 'rejected' },
      });
    });
  });
}

export function checkoutSessionsContract(
  name: string,
  setup: { readonly working: () => CheckoutSessions; readonly failing: () => CheckoutSessions },
): void {
  describe(`${name} (CheckoutSessions contract)`, () => {
    const request = {
      planId: 'school' as const,
      quantity: 12,
      customerEmail: 'admin@school.edu' as Email,
      clientReference: 'sub-1' as SubscriptionId,
      trialDays: 7,
      successUrl: 'https://app.test/billing/success',
      cancelUrl: 'https://app.test/billing',
    };

    it('returns a session id and an https checkout address', async () => {
      const result = await setup.working().createCheckout(request);
      expect(
        result.ok && result.value.sessionId.length > 0 && result.value.url.startsWith('https://'),
      ).toBe(true);
    });

    it('maps failures to typed errors', async () => {
      expect(await setup.failing().createCheckout(request)).toEqual({
        ok: false,
        error: { code: 'unavailable' },
      });
    });
  });
}

export function billingEventsContract(
  name: string,
  setup: {
    readonly make: () => BillingEvents;
    /** A payload and valid signature that represent `event`. */
    readonly sign: (event: BillingEvent) => {
      readonly payload: string;
      readonly signature: string;
    };
    readonly unsupportedPayload: () => { readonly payload: string; readonly signature: string };
  },
): void {
  describe(`${name} (BillingEvents contract)`, () => {
    const events: BillingEvent[] = [
      {
        type: 'checkout_completed',
        clientReference: 'sub-1' as SubscriptionId,
        externalId: 'ext-1',
        currentPeriodEnd: new Date('2027-09-01T00:00:00Z'),
      },
      { type: 'renewed', externalId: 'ext-1', currentPeriodEnd: new Date('2028-09-01T00:00:00Z') },
      { type: 'payment_failed', externalId: 'ext-1' },
      { type: 'canceled', externalId: 'ext-1' },
    ];

    it.each(events)('translates a signed $type event', (event) => {
      const { payload, signature } = setup.sign(event);
      expect(setup.make().parseWebhook(payload, signature)).toEqual({ ok: true, value: event });
    });

    it('rejects a bad signature', () => {
      const { payload } = setup.sign({ type: 'canceled', externalId: 'ext-1' });
      expect(setup.make().parseWebhook(payload, 'forged')).toEqual({
        ok: false,
        error: { code: 'invalid_signature' },
      });
    });

    it('reports events we do not handle', () => {
      const { payload, signature } = setup.unsupportedPayload();
      expect(setup.make().parseWebhook(payload, signature)).toEqual({
        ok: false,
        error: { code: 'unsupported_event' },
      });
    });
  });
}
