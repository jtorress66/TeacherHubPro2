import { defineConfig } from 'vitest/config';

// Integration tests (real Postgres via Testcontainers) arrive in step 3.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.int.test.ts', 'apps/*/src/**/*.int.test.ts'],
    passWithNoTests: true,
  },
});
