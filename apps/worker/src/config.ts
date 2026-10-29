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
