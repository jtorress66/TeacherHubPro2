import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';

export interface DatabaseConfig {
  readonly databaseUrl: string;
}

const missing = 'DATABASE_URL is required (postgres://user:password@host:port/database).';

const schema = z.object({
  DATABASE_URL: z
    .string({ error: missing })
    .min(1, missing)
    .refine(
      (value) =>
        URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'DATABASE_URL must be a postgres:// or postgresql:// address.',
    ),
});

/** Validates the database settings from the environment at the edge of the app. */
export function parseDatabaseConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<DatabaseConfig, string> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? missing);
  return ok({ databaseUrl: parsed.data.DATABASE_URL });
}

export interface StripeConfig {
  readonly secretKey: string;
}

/** The Stripe key for `pnpm stripe:setup`; whitespace pasted along with the key is removed. */
export function parseStripeConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<StripeConfig, string> {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (key === '') return err('STRIPE_SECRET_KEY is required.');
  if (!/^(sk|rk)_(test|live)_\S+$/.test(key)) {
    return err('STRIPE_SECRET_KEY must be a secret key (sk_ or rk_), not a publishable key.');
  }
  return ok({ secretKey: key });
}

export type LlmConfig =
  | { readonly provider: 'local' }
  | { readonly provider: 'anthropic'; readonly apiKey: string; readonly model: string | null };

/**
 * Which model drafts plans. `LLM_PROVIDER=local` is the scripted stand-in for tests and local
 * runs; without the setting, a configured ANTHROPIC_API_KEY means Claude.
 */
export function parseLlmConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<LlmConfig, string> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? '';
  const chosen = env.LLM_PROVIDER?.trim().toLowerCase() ?? '';
  const provider = chosen !== '' ? chosen : apiKey === '' ? 'local' : 'anthropic';
  if (provider === 'local') return ok({ provider });
  if (provider !== 'anthropic') return err('LLM_PROVIDER must be "anthropic" or "local".');
  if (apiKey === '') return err('ANTHROPIC_API_KEY is required when LLM_PROVIDER is "anthropic".');
  const model = env.ANTHROPIC_MODEL?.trim() ?? '';
  return ok({ provider, apiKey, model: model === '' ? null : model });
}

export const defaultVoice = 'nova';

export type TtsConfig =
  | { readonly provider: 'local'; readonly voice: string }
  | { readonly provider: 'openai'; readonly apiKey: string; readonly voice: string };

/**
 * Which service reads text aloud. `TTS_PROVIDER=local` is the silent stand-in for tests and
 * local runs; without the setting, a configured OPENAI_API_KEY means OpenAI.
 */
export function parseTtsConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<TtsConfig, string> {
  const apiKey = env.OPENAI_API_KEY?.trim() ?? '';
  const chosen = env.TTS_PROVIDER?.trim().toLowerCase() ?? '';
  const chosenVoice = env.OPENAI_TTS_VOICE?.trim() ?? '';
  const voice = chosenVoice === '' ? defaultVoice : chosenVoice;
  const provider = chosen !== '' ? chosen : apiKey === '' ? 'local' : 'openai';
  if (provider === 'local') return ok({ provider, voice });
  if (provider !== 'openai') return err('TTS_PROVIDER must be "openai" or "local".');
  if (apiKey === '') return err('OPENAI_API_KEY is required when TTS_PROVIDER is "openai".');
  return ok({ provider, apiKey, voice });
}

export type MailConfig = (
  | { readonly provider: 'local' }
  | {
      readonly provider: 'resend';
      readonly apiKey: string;
      readonly from: string;
      /** Where replies go (MAIL_REPLY_TO), when it is a valid email. */
      readonly replyTo?: string;
    }
) & {
  /** The site address, for links in emails (empty when not set: then nothing is sent). */
  readonly appUrl: string;
  /**
   * Whether sent mail reaches a person: always with Resend; with the stand-in, only outside
   * production (where the development mail page shows it). Reminders wait until it does.
   */
  readonly delivers: boolean;
};

/**
 * How email goes out. `MAIL_PROVIDER=local` (the default until go-live) keeps mail in the
 * database; `resend` sends it with RESEND_API_KEY from the verified MAIL_FROM address.
 */
export function parseMailConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<MailConfig, string> {
  const appUrl = (env.APP_URL?.trim() ?? '').replace(/\/$/u, '');
  // Without the site address emails would carry broken links: start anyway, sending nothing.
  if (appUrl === '') return ok({ provider: 'local', appUrl, delivers: false });
  const chosen = env.MAIL_PROVIDER?.trim().toLowerCase() ?? '';
  const provider = chosen === '' ? 'local' : chosen;
  if (provider === 'local') {
    return ok({ provider, appUrl, delivers: env.APP_ENV?.trim().toLowerCase() !== 'production' });
  }
  if (provider !== 'resend') return err('MAIL_PROVIDER must be "resend" or "local".');
  const apiKey = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.MAIL_FROM?.trim() ?? '';
  if (apiKey === '' || from === '') {
    return err('RESEND_API_KEY and MAIL_FROM are required when MAIL_PROVIDER is "resend".');
  }
  const replyTo = env.MAIL_REPLY_TO?.trim() ?? '';
  const replies = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(replyTo) ? { replyTo } : {};
  return ok({ provider, apiKey, from, ...replies, appUrl, delivers: true });
}

/** For the start-up log: the address links in emails use, so a stale APP_URL shows at once. */
export const emailLinksLine = (mail: MailConfig): string =>
  mail.appUrl === ''
    ? 'Email links: APP_URL is not set, so no email is sent.'
    : `Email links use ${mail.appUrl}`;

export type LtiConfig =
  | { readonly provider: 'off' }
  | { readonly provider: 'local' }
  | { readonly provider: 'on'; readonly encryptionKey: string };

/**
 * Whether the worker sends grades to schools' course systems (LTI), as the web app's LTI_PROVIDER:
 * off by default, "local" for the pretend course system (never in production), or "on", which
 * signs with the tool's key sealed by TOKEN_ENCRYPTION_KEY (the web app's).
 */
export function parseLtiConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<LtiConfig, string> {
  const chosen = env.LTI_PROVIDER?.trim().toLowerCase() ?? '';
  const provider = chosen === '' ? 'off' : chosen;
  if (provider === 'off') return ok({ provider });
  if (provider === 'local') {
    return env.APP_ENV?.trim().toLowerCase() === 'production'
      ? err('LTI_PROVIDER=local is only allowed when APP_ENV is development or test.')
      : ok({ provider });
  }
  if (provider !== 'on') return err('LTI_PROVIDER must be off, local or on.');
  const encryptionKey = env.TOKEN_ENCRYPTION_KEY?.trim() ?? '';
  if (Buffer.from(encryptionKey, 'base64').length !== 32) {
    return err('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.');
  }
  return ok({ provider, encryptionKey });
}
