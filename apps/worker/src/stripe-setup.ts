import { parseStripeConfig } from './config.ts';
import { setUpStripePrices } from './container.ts';

/** CLI: `pnpm stripe:setup`. Creates any missing Stripe products and prices; safe to run again. */
const config = parseStripeConfig(process.env);
if (!config.ok) {
  process.stderr.write(`${config.error}\n`);
  process.exit(1);
}

const result = await setUpStripePrices(config.value);
if (!result.ok) {
  process.stderr.write(`Stripe setup failed: ${result.error}\n`);
  process.exit(1);
}
for (const { planId, priceId, created } of result.value) {
  process.stdout.write(`${planId}: ${priceId} (${created ? 'created' : 'already existed'})\n`);
}
