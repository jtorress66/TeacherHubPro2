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
};

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
  TOKEN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
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
      },
    });
  });

  it('reads the voice that reads text aloud', () => {
    expect(parseWebConfig({ ...local, OPENAI_TTS_VOICE: ' coral ' })).toMatchObject({
      value: { voice: 'coral' },
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
          encryptionKey: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
        },
        voice: 'nova',
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
