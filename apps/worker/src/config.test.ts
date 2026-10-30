import { describe, expect, it } from 'vitest';
import {
  parseDatabaseConfig,
  parseLlmConfig,
  parseStripeConfig,
  parseTtsConfig,
} from './config.ts';

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
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: ' sk_test_xxxxxxxx\n' })).toEqual({
      ok: true,
      value: { secretKey: 'sk_test_xxxxxxxx' },
    });
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: 'rk_live_xxxxxxxx' }).ok).toBe(true);
  });

  it('refuses a missing key and a publishable key', () => {
    expect(parseStripeConfig({})).toEqual({ ok: false, error: 'STRIPE_SECRET_KEY is required.' });
    expect(parseStripeConfig({ STRIPE_SECRET_KEY: 'pk_test_abc' })).toEqual({
      ok: false,
      error: 'STRIPE_SECRET_KEY must be a secret key (sk_ or rk_), not a publishable key.',
    });
  });
});

describe('parseLlmConfig', () => {
  it('uses Claude when a key is set, with an optional model', () => {
    expect(parseLlmConfig({ ANTHROPIC_API_KEY: ' sk-ant-x ' })).toEqual({
      ok: true,
      value: { provider: 'anthropic', apiKey: 'sk-ant-x', model: null },
    });
    expect(
      parseLlmConfig({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-sonnet-5-5' }),
    ).toMatchObject({ value: { model: 'claude-sonnet-5-5' } });
  });

  it('uses the local stand-in when asked, or when there is no key', () => {
    expect(parseLlmConfig({})).toEqual({ ok: true, value: { provider: 'local' } });
    expect(parseLlmConfig({ LLM_PROVIDER: 'local', ANTHROPIC_API_KEY: 'k' })).toEqual({
      ok: true,
      value: { provider: 'local' },
    });
  });

  it('refuses Claude without a key and an unknown provider', () => {
    expect(parseLlmConfig({ LLM_PROVIDER: 'anthropic' })).toEqual({
      ok: false,
      error: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER is "anthropic".',
    });
    expect(parseLlmConfig({ LLM_PROVIDER: 'gpt' }).ok).toBe(false);
  });
});

describe('parseTtsConfig', () => {
  it('uses OpenAI when a key is set, with the nova voice unless another is chosen', () => {
    expect(parseTtsConfig({ OPENAI_API_KEY: ' sk-x ' })).toEqual({
      ok: true,
      value: { provider: 'openai', apiKey: 'sk-x', voice: 'nova' },
    });
    expect(parseTtsConfig({ OPENAI_API_KEY: 'k', OPENAI_TTS_VOICE: 'coral' })).toMatchObject({
      value: { voice: 'coral' },
    });
  });

  it('uses the local stand-in when asked, or when there is no key', () => {
    expect(parseTtsConfig({})).toEqual({ ok: true, value: { provider: 'local', voice: 'nova' } });
    expect(parseTtsConfig({ TTS_PROVIDER: 'local', OPENAI_API_KEY: 'k' })).toMatchObject({
      value: { provider: 'local' },
    });
  });

  it('refuses OpenAI without a key and an unknown provider', () => {
    expect(parseTtsConfig({ TTS_PROVIDER: 'openai' })).toEqual({
      ok: false,
      error: 'OPENAI_API_KEY is required when TTS_PROVIDER is "openai".',
    });
    expect(parseTtsConfig({ TTS_PROVIDER: 'robot' }).ok).toBe(false);
  });
});
