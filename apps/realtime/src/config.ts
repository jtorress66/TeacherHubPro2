import { z } from 'zod';
import { err, ok, type Result } from '@thp/domain';

export interface RealtimeConfig {
  readonly databaseUrl: string;
  /** Shared with the web app, which signs the tickets. */
  readonly ticketSecret: string;
  /** Browsers may connect only from the web app's pages. */
  readonly allowedOrigin: string;
  readonly port: number;
}

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required.' })
    .refine(
      (value) =>
        URL.canParse(value) && ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
      'DATABASE_URL must be a postgres:// or postgresql:// address.',
    ),
  REALTIME_TICKET_SECRET: z
    .string({ error: 'REALTIME_TICKET_SECRET is required.' })
    .min(32, 'REALTIME_TICKET_SECRET must be at least 32 characters.'),
  APP_URL: z
    .string({ error: 'APP_URL is required.' })
    .refine((value) => URL.canParse(value), 'APP_URL must be the web app’s address.'),
  PORT: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? 3200 : Number(value)))
    .pipe(
      z.number({ error: 'PORT must be a number.' }).int('PORT must be a number.').min(1).max(65535),
    ),
});

/** Validates the realtime server's environment at the edge. */
export function parseRealtimeConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<RealtimeConfig, string> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? 'Invalid settings.');
  return ok({
    databaseUrl: parsed.data.DATABASE_URL,
    ticketSecret: parsed.data.REALTIME_TICKET_SECRET,
    allowedOrigin: new URL(parsed.data.APP_URL).origin,
    port: parsed.data.PORT,
  });
}
