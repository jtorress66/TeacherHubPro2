import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Email } from '@thp/domain';
import { mailerContract } from '@thp/testing';
import { ResendMailer } from '../src/mail/resend-mailer.ts';

const baseURL = 'https://resend.test';
const endpoint = `${baseURL}/emails`;
const server = setupServer();
beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const mailer = () =>
  new ResendMailer({ apiKey: 're_test', from: 'TeacherHubPro <hello@teacherhub.test>', baseURL });

const message = {
  to: 'parent@example.com' as Email,
  subject: 'Ana’s progress',
  html: '<p>Hello</p>',
  text: 'Hello',
};

mailerContract('ResendMailer', {
  accepting: () => {
    server.use(http.post(endpoint, () => HttpResponse.json({ id: 'email-123' })));
    return mailer();
  },
  rejecting: () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json(
          { statusCode: 422, name: 'validation_error', message: 'recorded' },
          { status: 422 },
        ),
      ),
    );
    return mailer();
  },
});

describe('ResendMailer', () => {
  it('posts the message from the configured sender with the API key', async () => {
    let body: unknown;
    let auth: string | null = null;
    server.use(
      http.post(endpoint, async ({ request }) => {
        body = await request.json();
        auth = request.headers.get('authorization');
        return HttpResponse.json({ id: 'email-123' });
      }),
    );
    expect(await mailer().send(message)).toEqual({ ok: true, value: { messageId: 'email-123' } });
    expect(auth).toBe('Bearer re_test');
    expect(body).toEqual({
      from: 'TeacherHubPro <hello@teacherhub.test>',
      to: ['parent@example.com'],
      subject: 'Ana’s progress',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
  });

  it('treats a server error, a rate limit or no connection as unavailable', async () => {
    for (const status of [429, 500, 503]) {
      server.use(http.post(endpoint, () => HttpResponse.json({}, { status })));
      expect(await mailer().send(message)).toEqual({ ok: false, error: { code: 'unavailable' } });
    }
    server.use(http.post(endpoint, () => HttpResponse.error()));
    expect(await mailer().send(message)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
