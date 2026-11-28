import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

/**
 * Retakes the /demo tour's screenshots (`pnpm tour:capture`). With TOUR_AI=claude the worker
 * drafts with real Claude, which costs money: only when the owner asks (CI → "Retake tour").
 */
const claude = process.env.TOUR_AI === 'claude';
const servers = Array.isArray(base.webServer) ? base.webServer : [];

export default defineConfig({
  ...base,
  testDir: './e2e/tour',
  testIgnore: [],
  workers: 1,
  retries: 1,
  reporter: 'list',
  // A step that cannot happen fails in seconds instead of waiting out the whole run.
  use: { ...base.use, actionTimeout: 30_000 },
  webServer: servers.map((server) =>
    claude && server.name === 'Worker'
      ? { ...server, env: { ...server.env, LLM_PROVIDER: 'anthropic' } }
      : server,
  ),
});
