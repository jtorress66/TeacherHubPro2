import { defineConfig, devices } from '@playwright/test';

const port = 3100;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm start --port ${String(port)}`,
    url: `http://localhost:${String(port)}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
