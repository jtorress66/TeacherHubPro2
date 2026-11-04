import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const realtimePort = 3200;
const ticketSecret = 'e2e-realtime-ticket-secret-0123456789';
const appUrl = `http://localhost:${String(port)}`;
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://teacherhub:teacherhub@localhost:5433/teacherhub';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['stripe/**'],
  forbidOnly: !!process.env.CI,
  // Locally, one test at a time: parallel workers compete for CPU with the app and the worker.
  ...(process.env.CI ? {} : { workers: 1 }),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `pnpm start --port ${String(port)}`,
      url: `${appUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      // The local stand-ins for Stripe and Google; the database comes from `pnpm db:up` (or CI).
      env: {
        DATABASE_URL: databaseUrl,
        APP_URL: appUrl,
        APP_ENV: 'test',
        BILLING_PROVIDER: 'local',
        LOCAL_BILLING_SECRET: 'e2e-local-billing-secret',
        GOOGLE_AUTH_PROVIDER: 'local',
        LOCAL_GOOGLE_SECRET: 'e2e-local-google-secret',
        REALTIME_URL: `http://localhost:${String(realtimePort)}`,
        REALTIME_TICKET_SECRET: ticketSecret,
      },
    },
    {
      // Live games over WebSockets, sharing the ticket secret with the web app.
      name: 'Realtime',
      command: 'pnpm --filter @thp/realtime start',
      url: `http://localhost:${String(realtimePort)}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: databaseUrl,
        APP_URL: appUrl,
        PORT: String(realtimePort),
        REALTIME_TICKET_SECRET: ticketSecret,
      },
    },
    {
      // The background worker, with the scripted stand-ins for Claude and the voice service.
      name: 'Worker',
      command: 'pnpm --filter @thp/worker start',
      wait: { stdout: /Worker started/ },
      stdout: 'pipe',
      timeout: 60_000,
      env: { DATABASE_URL: databaseUrl, LLM_PROVIDER: 'local', TTS_PROVIDER: 'local' },
    },
  ],
});
