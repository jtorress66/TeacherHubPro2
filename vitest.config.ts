import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'tests/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'apps/*/src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/index.ts', 'apps/web/src/app/**', 'apps/web/e2e/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'packages/domain/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'packages/agents/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
