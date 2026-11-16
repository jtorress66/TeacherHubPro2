import { describe, expect, it } from 'vitest';
import {
  parseDatabaseConfig,
  parseLlmConfig,
  parseLtiConfig,
  parseMailConfig,
  parseStripeConfig,
  parseTtsConfig,
  emailLinksLine,
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

describe('parseMailConfig', () => {
  const base = { APP_URL: 'https://teacherhubpro-web.onrender.com/' };

  it('uses the local stand-in by default, with the site address for links', () => {
    expect(parseMailConfig(base)).toEqual({
      ok: true,
      value: {
        provider: 'local',
        appUrl: 'https://teacherhubpro-web.onrender.com',
        delivers: true,
      },
    });
  });

  it('in production, the stand-in delivers nothing: reminders wait for a real mailer', () => {
    expect(parseMailConfig({ ...base, APP_ENV: 'production' })).toMatchObject({
      ok: true,
      value: { provider: 'local', delivers: false },
    });
  });

  it('sends real mail through Resend with a key and a sender', () => {
    expect(
      parseMailConfig({
        ...base,
        MAIL_PROVIDER: 'resend',
        RESEND_API_KEY: ' re_x ',
        MAIL_FROM: 'TeacherHubPro <hello@teacherhubpro.com>',
      }),
    ).toEqual({
      ok: true,
      value: {
        provider: 'resend',
        apiKey: 're_x',
        from: 'TeacherHubPro <hello@teacherhubpro.com>',
        appUrl: 'https://teacherhubpro-web.onrender.com',
        delivers: true,
      },
    });
  });

  it('without the site address, starts anyway with reminders off (links need it)', () => {
    expect(parseMailConfig({})).toEqual({
      ok: true,
      value: { provider: 'local', appUrl: '', delivers: false },
    });
  });

  it('is an error when Resend is chosen without its key or sender', () => {
    expect(parseMailConfig({ ...base, MAIL_PROVIDER: 'resend', MAIL_FROM: 'a@b.c' })).toEqual({
      ok: false,
      error: 'RESEND_API_KEY and MAIL_FROM are required when MAIL_PROVIDER is "resend".',
    });
    expect(parseMailConfig({ ...base, MAIL_PROVIDER: 'pigeon' }).ok).toBe(false);
  });
});

describe('emailLinksLine', () => {
  it('names the address email links use, for the start-up log', () => {
    expect(
      emailLinksLine({ provider: 'local', appUrl: 'https://teacherhubpro.com', delivers: true }),
    ).toBe('Email links use https://teacherhubpro.com');
  });

  it('says so when no address is set', () => {
    expect(emailLinksLine({ provider: 'local', appUrl: '', delivers: false })).toBe(
      'Email links: APP_URL is not set, so no email is sent.',
    );
  });
});

describe('parseLtiConfig', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('keeps sending grades to course systems off unless LTI_PROVIDER turns it on', () => {
    expect(parseLtiConfig({})).toEqual({ ok: true, value: { provider: 'off' } });
    expect(parseLtiConfig({ LTI_PROVIDER: ' Off ' })).toEqual({
      ok: true,
      value: { provider: 'off' },
    });
  });

  it('sends to the pretend course system in development and tests only', () => {
    expect(parseLtiConfig({ LTI_PROVIDER: 'local' })).toEqual({
      ok: true,
      value: { provider: 'local' },
    });
    expect(parseLtiConfig({ LTI_PROVIDER: 'local', APP_ENV: 'production' })).toEqual({
      ok: false,
      error: 'LTI_PROVIDER=local is only allowed when APP_ENV is development or test.',
    });
  });

  it('signs with the tool key sealed by TOKEN_ENCRYPTION_KEY when on', () => {
    expect(parseLtiConfig({ LTI_PROVIDER: 'on', TOKEN_ENCRYPTION_KEY: key })).toEqual({
      ok: true,
      value: { provider: 'on', encryptionKey: key },
    });
    expect(parseLtiConfig({ LTI_PROVIDER: 'on', TOKEN_ENCRYPTION_KEY: 'short' })).toEqual({
      ok: false,
      error: 'TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.',
    });
    expect(parseLtiConfig({ LTI_PROVIDER: 'canvas' })).toEqual({
      ok: false,
      error: 'LTI_PROVIDER must be off, local or on.',
    });
  });
});

describe('provider names', () => {
  it('are read whatever their capitals', () => {
    expect(parseLlmConfig({ LLM_PROVIDER: 'Local' })).toEqual({
      ok: true,
      value: { provider: 'local' },
    });
    expect(parseTtsConfig({ TTS_PROVIDER: 'LOCAL' })).toMatchObject({
      value: { provider: 'local' },
    });
    expect(
      parseMailConfig({
        APP_URL: 'https://teacherhubpro.com',
        APP_ENV: 'Production',
        MAIL_PROVIDER: 'Local',
      }),
    ).toMatchObject({ value: { provider: 'local', delivers: false } });
  });
});
