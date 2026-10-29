import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';

export type AppEnv = 'development' | 'test' | 'production';

export type BillingConfig =
  | { readonly provider: 'local'; readonly secret: string }
  | { readonly provider: 'stripe'; readonly secretKey: string; readonly webhookSecret: string };

export type GoogleConfig =
  | { readonly provider: 'local'; readonly secret: string }
  | { readonly provider: 'google'; readonly clientId: string; readonly clientSecret: string };

export interface WebConfig {
  readonly databaseUrl: string;
  readonly appUrl: string;
  readonly env: AppEnv;
  readonly billing: BillingConfig;
  readonly google: GoogleConfig;
}

const required = (name: string) => ({ error: `${name} is required` });
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
  });
}
