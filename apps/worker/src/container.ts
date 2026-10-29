import {
  createDatabase,
  createStripeClient,
  ensureStripePrices,
  migrateToLatest,
} from '@thp/adapters';
import type { DatabaseConfig, StripeConfig } from './config.ts';

// Composition root: the only place in the worker where concrete adapters are created.
export const container = {} as const;

/** Opens a connection, applies pending migrations and closes it again. */
export async function runMigrations({ databaseUrl }: DatabaseConfig) {
  const db = createDatabase(databaseUrl);
  try {
    return await migrateToLatest(db);
  } finally {
    await db.destroy();
  }
}

/** Makes sure Stripe has a product and price for every plan in the catalog. */
export function setUpStripePrices({ secretKey }: StripeConfig) {
  return ensureStripePrices(createStripeClient(secretKey));
}
