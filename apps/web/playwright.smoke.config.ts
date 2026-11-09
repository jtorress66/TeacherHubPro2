import { defineConfig, devices } from '@playwright/test';

/**
 * Read-only checks of the live site (workflow `smoke.yml`, or `pnpm test:smoke`): no accounts
 * made, no chat sent, so nothing is paid for. SMOKE_URL is the site's address.
 */
export default defineConfig({
  testDir: './e2e/smoke',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.SMOKE_URL ?? 'https://teacherhubpro-web.onrender.com',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
