import { describe, expect, it } from 'vitest';
import { parseWebConfig } from './config.ts';

const local = {
  DATABASE_URL: 'postgres://teacherhub:teacherhub@localhost:5433/teacherhub',
  APP_URL: 'http://localhost:3000/',
  APP_ENV: 'development',
  BILLING_PROVIDER: 'local',
  LOCAL_BILLING_SECRET: 'local-billing-secret-123',
  GOOGLE_AUTH_PROVIDER: 'local',
  LOCAL_GOOGLE_SECRET: 'local-google-secret-1234',
  REALTIME_URL: 'http://localhost:3200/',
  REALTIME_TICKET_SECRET: 'local-realtime-ticket-secret-1234567',
};

/** An obviously fake 32-byte key, built at run time so no key-like text is checked in. */
const testEncryptionKey = Buffer.alloc(32, 1).toString('base64');

const production = {
  DATABASE_URL: 'postgresql://app:pw@db.internal:5432/teacherhub',
  APP_URL: 'https://teacherhubpro.com',
  APP_ENV: 'production',
  BILLING_PROVIDER: 'stripe',
  STRIPE_SECRET_KEY: 'sk_live_xxxxxxxx',
  STRIPE_WEBHOOK_SECRET: 'whsec_xxxxxxxx',
  GOOGLE_AUTH_PROVIDER: 'google',
  GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  CLASSROOM_PROVIDER: 'google',
  TOKEN_ENCRYPTION_KEY: testEncryptionKey,
  REALTIME_URL: 'https://teacherhubpro-realtime.onrender.com',
  REALTIME_TICKET_SECRET: 'r'.repeat(32),
};

/** A copy of the environment with one variable removed. */
const without = (env: Record<string, string>, name: string): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter(([key]) => key !== name));

describe('parseWebConfig', () => {
  it('reads a local development setup and drops a trailing slash from APP_URL', () => {
    expect(parseWebConfig(local)).toEqual({
      ok: true,
      value: {
        databaseUrl: local.DATABASE_URL,
        appUrl: 'http://localhost:3000',
        env: 'development',
        billing: { provider: 'local', secret: local.LOCAL_BILLING_SECRET },
        google: { provider: 'local', secret: local.LOCAL_GOOGLE_SECRET },
        classroom: { provider: 'local' },
        voice: 'nova',
        realtime: {
          url: 'http://localhost:3200',
          ticketSecret: local.REALTIME_TICKET_SECRET,
        },
        mail: { provider: 'local', delivers: true },
        superAdminSetupKey: null,
        leadsNotifyEmail: null,
      },
    });
  });

  it('emails high-priority leads to a valid team address only', () => {
    const team = parseWebConfig({ ...local, LEADS_NOTIFY_EMAIL: ' team@teacherhubpro.com ' });
    expect(team.ok && team.value.leadsNotifyEmail).toBe('team@teacherhubpro.com');
    const bad = parseWebConfig({ ...local, LEADS_NOTIFY_EMAIL: 'not-an-email' });
    expect(bad.ok && bad.value.leadsNotifyEmail).toBeNull();
  });

  it('turns on the first super admin setup only when a key is set', () => {
    const key = parseWebConfig({ ...local, SUPER_ADMIN_SETUP_KEY: '  a-long-secret  ' });
    expect(key.ok && key.value.superAdminSetupKey).toBe('a-long-secret');
    const blank = parseWebConfig({ ...local, SUPER_ADMIN_SETUP_KEY: ' ' });
    expect(blank.ok && blank.value.superAdminSetupKey).toBeNull();
  });

  it('sends mail with Resend when set up; without it, production mail reaches no one', () => {
    expect(
      parseWebConfig({
        ...production,
        MAIL_PROVIDER: 'resend',
        RESEND_API_KEY: 're_xxx',
        MAIL_FROM: 'TeacherHubPro <hello@teacherhubpro.com>',
      }),
    ).toMatchObject({
      value: {
        mail: {
          provider: 'resend',
          apiKey: 're_xxx',
          from: 'TeacherHubPro <hello@teacherhubpro.com>',
          delivers: true,
        },
      },
    });
    expect(parseWebConfig(production)).toMatchObject({
      ok: true,
      value: { mail: { provider: 'local', delivers: false } },
    });
    expect(parseWebConfig({ ...production, MAIL_PROVIDER: 'resend' })).toEqual({
      ok: false,
      error: 'RESEND_API_KEY and MAIL_FROM are required when MAIL_PROVIDER is resend',
    });
    expect(parseWebConfig({ ...local, MAIL_PROVIDER: 'pigeon' }).ok).toBe(false);
  });

  it('needs the realtime server’s address and a ticket secret of at least 32 characters', () => {
    expect(parseWebConfig(without(local, 'REALTIME_URL'))).toEqual({
      ok: false,
      error: 'REALTIME_URL is required',
    });
    expect(parseWebConfig({ ...local, REALTIME_URL: 'ws://x' })).toEqual({
      ok: false,
      error: 'REALTIME_URL must be an absolute http(s) URL',
    });
    expect(parseWebConfig({ ...local, REALTIME_TICKET_SECRET: 'short' })).toEqual({
      ok: false,
      error: 'REALTIME_TICKET_SECRET must be at least 32 characters',
    });
  });

  it('reads the voice that reads text aloud', () => {
    expect(parseWebConfig({ ...local, OPENAI_TTS_VOICE: ' coral ' })).toMatchObject({
      value: { voice: 'coral' },
    });
  });

  it('leaves reading aloud to the device in production until OpenAI speech is on', () => {
    expect(parseWebConfig({ ...production, TTS_PROVIDER: 'openai' })).toMatchObject({
      value: { voice: 'nova' },
    });
    expect(parseWebConfig({ ...production, TTS_PROVIDER: 'local' })).toMatchObject({
      value: { voice: null },
    });
    expect(parseWebConfig({ ...local, TTS_PROVIDER: 'local' })).toMatchObject({
      value: { voice: 'nova' },
    });
  });

  it('ignores spaces and line breaks pasted around a setting', () => {
    const pasted = {
      ...production,
      STRIPE_SECRET_KEY: ' sk_live_xxxxxxxx\n',
      STRIPE_WEBHOOK_SECRET: 'whsec_xxxxxxxx \r\n',
      BILLING_PROVIDER: 'stripe ',
    };
    expect(parseWebConfig(pasted)).toMatchObject({
      ok: true,
      value: {
        billing: {
          provider: 'stripe',
          secretKey: 'sk_live_xxxxxxxx',
          webhookSecret: 'whsec_xxxxxxxx',
        },
      },
    });
  });

  it('reads a production setup with Stripe and Google', () => {
    expect(parseWebConfig(production)).toEqual({
      ok: true,
      value: {
        databaseUrl: production.DATABASE_URL,
        appUrl: production.APP_URL,
        env: 'production',
        billing: {
          provider: 'stripe',
          secretKey: 'sk_live_xxxxxxxx',
          webhookSecret: 'whsec_xxxxxxxx',
        },
        google: {
          provider: 'google',
          clientId: production.GOOGLE_CLIENT_ID,
          clientSecret: 'google-secret',
        },
        classroom: {
          provider: 'google',
          clientId: production.GOOGLE_CLIENT_ID,
          clientSecret: 'google-secret',
          encryptionKey: testEncryptionKey,
        },
        voice: null,
        realtime: {
          url: 'https://teacherhubpro-realtime.onrender.com',
          ticketSecret: production.REALTIME_TICKET_SECRET,
        },
        mail: { provider: 'local', delivers: false },
        superAdminSetupKey: null,
        leadsNotifyEmail: null,
      },
    });
  });

  it('assumes production when APP_ENV is not set', () => {
    const withoutEnv = without(production, 'APP_ENV');
    expect(parseWebConfig(withoutEnv).ok && parseWebConfig(withoutEnv)).toMatchObject({
      value: { env: 'production' },
    });
  });

  it('refuses the local test checkout and test Google sign-in in production', () => {
    expect(parseWebConfig({ ...local, APP_ENV: 'production' })).toEqual({
      ok: false,
      error: 'BILLING_PROVIDER=local is only allowed when APP_ENV is development or test',
    });
    expect(
      parseWebConfig({
        ...production,
        GOOGLE_AUTH_PROVIDER: 'local',
        LOCAL_GOOGLE_SECRET: 'x'.repeat(20),
      }),
    ).toEqual({
      ok: false,
      error: 'GOOGLE_AUTH_PROVIDER=local is only allowed when APP_ENV is development or test',
    });
  });

  it('uses the Classroom stand-in unless told otherwise, but never in production', () => {
    expect(parseWebConfig({ ...local, CLASSROOM_PROVIDER: 'local' }).ok).toBe(true);
    expect(parseWebConfig(without(production, 'CLASSROOM_PROVIDER'))).toEqual({
      ok: false,
      error: 'CLASSROOM_PROVIDER=local is only allowed when APP_ENV is development or test',
    });
  });

  it('needs a 32-byte encryption key and the Google client for real Classroom', () => {
    expect(parseWebConfig({ ...production, TOKEN_ENCRYPTION_KEY: 'c2hvcnQ=' })).toEqual({
      ok: false,
      error: 'TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded',
    });
    expect(parseWebConfig(without(production, 'TOKEN_ENCRYPTION_KEY')).ok).toBe(false);
    expect(
      parseWebConfig({
        ...local,
        CLASSROOM_PROVIDER: 'google',
        TOKEN_ENCRYPTION_KEY: production.TOKEN_ENCRYPTION_KEY,
      }),
    ).toEqual({
      ok: false,
      error: 'CLASSROOM_PROVIDER=google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    });
  });

  it('requires every secret, with no defaults', () => {
    expect(parseWebConfig(without(local, 'DATABASE_URL'))).toEqual({
      ok: false,
      error: 'DATABASE_URL is required',
    });
    expect(parseWebConfig(without(local, 'LOCAL_BILLING_SECRET')).ok).toBe(false);
    expect(parseWebConfig(without(production, 'STRIPE_WEBHOOK_SECRET')).ok).toBe(false);
    expect(parseWebConfig(without(production, 'GOOGLE_CLIENT_SECRET')).ok).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(parseWebConfig({ ...local, DATABASE_URL: 'mysql://x' })).toEqual({
      ok: false,
      error: 'DATABASE_URL must be a postgres:// URL',
    });
    expect(parseWebConfig({ ...local, APP_URL: 'localhost' })).toEqual({
      ok: false,
      error: 'APP_URL must be an absolute http(s) URL',
    });
    expect(parseWebConfig({ ...local, LOCAL_BILLING_SECRET: 'short' })).toEqual({
      ok: false,
      error: 'LOCAL_BILLING_SECRET must be at least 16 characters',
    });
    expect(parseWebConfig({ ...production, STRIPE_SECRET_KEY: 'pk_live_abc' })).toEqual({
      ok: false,
      error: 'STRIPE_SECRET_KEY must be a secret key (sk_ or rk_)',
    });
    expect(parseWebConfig({ ...production, STRIPE_WEBHOOK_SECRET: 'abc' })).toEqual({
      ok: false,
      error: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
    });
    expect(parseWebConfig({ ...local, BILLING_PROVIDER: 'paypal' }).ok).toBe(false);
  });
});
