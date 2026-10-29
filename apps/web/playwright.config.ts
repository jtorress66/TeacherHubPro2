import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const appUrl = `http://localhost:${String(port)}`;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['stripe/**'],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start --port ${String(port)}`,
    url: `${appUrl}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // The local stand-ins for Stripe and Google; the database comes from `pnpm db:up` (or CI).
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://teacherhub:teacherhub@localhost:5433/teacherhub',
      APP_URL: appUrl,
      APP_ENV: 'test',
      BILLING_PROVIDER: 'local',
      LOCAL_BILLING_SECRET: 'e2e-local-billing-secret',
      GOOGLE_AUTH_PROVIDER: 'local',
      LOCAL_GOOGLE_SECRET: 'e2e-local-google-secret',
    },
  },
});
