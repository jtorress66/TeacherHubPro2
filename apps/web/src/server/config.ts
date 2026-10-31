import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';

export type AppEnv = 'development' | 'test' | 'production';

export type BillingConfig =
  | { readonly provider: 'local'; readonly secret: string }
  | { readonly provider: 'stripe'; readonly secretKey: string; readonly webhookSecret: string };

export type GoogleConfig =
  | { readonly provider: 'local'; readonly secret: string }
  | { readonly provider: 'google'; readonly clientId: string; readonly clientSecret: string };

export type ClassroomConfig =
  | { readonly provider: 'local' }
  | {
      readonly provider: 'google';
      readonly clientId: string;
      readonly clientSecret: string;
      /** Encrypts teachers' Classroom refresh tokens at rest. */
      readonly encryptionKey: string;
    };

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly env: AppEnv;
  readonly billing: BillingConfig;
  readonly google: GoogleConfig;
  readonly classroom: ClassroomConfig;
  /** The voice that reads text aloud (the worker makes the audio with the same one). */
  readonly voice: string;
}

const required = (name: string) => ({ error: `${name} is required` });

const defaultVoice = 'nova';

const voiceFrom = (env: Readonly<Record<string, string | undefined>>): string => {
  const voice = env.OPENAI_TTS_VOICE?.trim() ?? '';
  return voice === '' ? defaultVoice : voice;
};
const localSecret = (name: string) =>
  z.string(required(name)).min(16, `${name} must be at least 16 characters`);

const shared = z.object({
  DATABASE_URL: z
    .string(required('DATABASE_URL'))
    .regex(/^postgres(ql)?:\/\/\S+$/, 'DATABASE_URL must be a postgres:// URL'),
  APP_URL: z
    .string(required('APP_URL'))
    .regex(/^https?:\/\/\S+$/, 'APP_URL must be an absolute http(s) URL'),
  APP_ENV: z.enum(['development', 'test', 'production']).default('production'),
});

const billing = z.discriminatedUnion(
  'BILLING_PROVIDER',
  [
    z.object({
      BILLING_PROVIDER: z.literal('local'),
      LOCAL_BILLING_SECRET: localSecret('LOCAL_BILLING_SECRET'),
    }),
    z.object({
      BILLING_PROVIDER: z.literal('stripe'),
      STRIPE_SECRET_KEY: z
        .string(required('STRIPE_SECRET_KEY'))
        .regex(/^(sk|rk)_(test|live)_\S+$/, 'STRIPE_SECRET_KEY must be a secret key (sk_ or rk_)'),
      STRIPE_WEBHOOK_SECRET: z
        .string(required('STRIPE_WEBHOOK_SECRET'))
        .startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),
    }),
  ],
  { error: 'BILLING_PROVIDER must be local or stripe' },
);

const google = z.discriminatedUnion(
  'GOOGLE_AUTH_PROVIDER',
  [
    z.object({
      GOOGLE_AUTH_PROVIDER: z.literal('local'),
      LOCAL_GOOGLE_SECRET: localSecret('LOCAL_GOOGLE_SECRET'),
    }),
    z.object({
      GOOGLE_AUTH_PROVIDER: z.literal('google'),
      GOOGLE_CLIENT_ID: z
        .string(required('GOOGLE_CLIENT_ID'))
        .min(1, 'GOOGLE_CLIENT_ID is required'),
      GOOGLE_CLIENT_SECRET: z
        .string(required('GOOGLE_CLIENT_SECRET'))
        .min(1, 'GOOGLE_CLIENT_SECRET is required'),
    }),
  ],
  { error: 'GOOGLE_AUTH_PROVIDER must be local or google' },
);

const schema = shared.and(billing).and(google);

const localOnly = (setting: string) =>
  `${setting}=local is only allowed when APP_ENV is development or test`;

/**
 * Google Classroom: the local stand-in unless CLASSROOM_PROVIDER=google, which needs the Google
 * client and a 32-byte TOKEN_ENCRYPTION_KEY. The stand-in is refused in production.
 */
function classroomFrom(
  env: Readonly<Record<string, string | undefined>>,
  appEnv: AppEnv,
): Result<ClassroomConfig, string> {
  const chosen = env.CLASSROOM_PROVIDER?.trim() ?? '';
  const provider = chosen === '' ? 'local' : chosen;
  if (provider === 'local') {
    return appEnv === 'production' ? err(localOnly('CLASSROOM_PROVIDER')) : ok({ provider });
  }
  if (provider !== 'google') return err('CLASSROOM_PROVIDER must be local or google');
  const encryptionKey = env.TOKEN_ENCRYPTION_KEY?.trim() ?? '';
  if (Buffer.from(encryptionKey, 'base64').length !== 32) {
    return err('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded');
  }
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? '';
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? '';
  if (clientId === '' || clientSecret === '') {
    return err('CLASSROOM_PROVIDER=google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }
  return ok({ provider, clientId, clientSecret, encryptionKey });
}

/**
 * Validates the web app's environment once, at the edge. Every secret is required (there are no
 * defaults), APP_ENV defaults to production, and the local stand-ins are refused in production.
 */
export function parseWebConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<WebConfig, string> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid configuration');
  const c = parsed.data;
  if (c.APP_ENV === 'production' && c.BILLING_PROVIDER === 'local')
    return err(localOnly('BILLING_PROVIDER'));
  if (c.APP_ENV === 'production' && c.GOOGLE_AUTH_PROVIDER === 'local')
    return err(localOnly('GOOGLE_AUTH_PROVIDER'));
  const classroom = classroomFrom(env, c.APP_ENV);
  if (!classroom.ok) return classroom;

  return ok({
    databaseUrl: c.DATABASE_URL,
    appUrl: c.APP_URL.replace(/\/$/, ''),
    env: c.APP_ENV,
    billing:
      c.BILLING_PROVIDER === 'local'
        ? { provider: 'local', secret: c.LOCAL_BILLING_SECRET }
        : {
            provider: 'stripe',
            secretKey: c.STRIPE_SECRET_KEY,
            webhookSecret: c.STRIPE_WEBHOOK_SECRET,
          },
    google:
      c.GOOGLE_AUTH_PROVIDER === 'local'
        ? { provider: 'local', secret: c.LOCAL_GOOGLE_SECRET }
        : {
            provider: 'google',
            clientId: c.GOOGLE_CLIENT_ID,
            clientSecret: c.GOOGLE_CLIENT_SECRET,
          },
    classroom: classroom.value,
    voice: voiceFrom(env),
  });
}
