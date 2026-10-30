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
  const chosen = env.LLM_PROVIDER?.trim() ?? '';
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
  const chosen = env.TTS_PROVIDER?.trim() ?? '';
  const chosenVoice = env.OPENAI_TTS_VOICE?.trim() ?? '';
  const voice = chosenVoice === '' ? defaultVoice : chosenVoice;
  const provider = chosen !== '' ? chosen : apiKey === '' ? 'local' : 'openai';
  if (provider === 'local') return ok({ provider, voice });
  if (provider !== 'openai') return err('TTS_PROVIDER must be "openai" or "local".');
  if (apiKey === '') return err('OPENAI_API_KEY is required when TTS_PROVIDER is "openai".');
  return ok({ provider, apiKey, voice });
}
