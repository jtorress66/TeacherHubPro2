import { describe, expect, it } from 'vitest';
import { parseDatabaseConfig, parseStripeConfig } from './config.ts';

describe('parseDatabaseConfig', () => {
  it('reads a Postgres connection string from DATABASE_URL', () => {
    expect(parseDatabaseConfig({ DATABASE_URL: 'postgres://thp:thp@localhost:5432/thp' })).toEqual({
      ok: true,
      value: { databaseUrl: 'postgres://thp:thp@localhost:5432/thp' },
    });
    expect(parseDatabaseConfig({ DATABASE_URL: 'postgresql://db.internal/thp' }).ok).toBe(true);
  });

  it('is an error when DATABASE_URL is missing', () => {
    expect(parseDatabaseConfig({})).toEqual({
      ok: false,
      error: 'DATABASE_URL is required (postgres://user:password@host:port/database).',
    });
  });

  it('is an error when DATABASE_URL is not a Postgres address', () => {
    expect(parseDatabaseConfig({ DATABASE_URL: 'mysql://localhost/thp' }).ok).toBe(false);
    expect(parseDatabaseConfig({ DATABASE_URL: 'not a url' }).ok).toBe(false);
  });
});

describe('parseStripeConfig', () => {
  it('reads a Stripe secret key, trimming pasted whitespace', () => {
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: ' sk_test_abc123\n' })).toEqual({
      ok: true,
      value: { secretKey: 'sk_test_abc123' },
    });
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: 'rk_live_abc' }).ok).toBe(true);
  });

  it('refuses a missing key and a publishable key', () => {
    expect(parseStripeConfig({})).toEqual({ ok: false, error: 'STRIPE_SECRET_KEY is required.' });
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: 'pk_test_abc' })).toEqual({
      ok: false,
      error: 'STRIPE_SECRET_KEY must be a secret key (sk_ or rk_), not a publishable key.',
    });
  });
});
