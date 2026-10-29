import { defineConfig } from 'vitest/config';

const full = { lines: 100, functions: 100, branches: 100, statements: 100 };

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
      'tests/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/*.int.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'apps/*/src/**/*.tsx'],
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        '**/test-support.ts',
        'packages/testing/src/contracts/**',
        // Only meaningful against a real database; covered by `pnpm test:int` (≥ 90%).
        'packages/adapters/src/postgres/{repositories,migrations}/**',
        'packages/adapters/src/postgres/{database,migrate,upsert}.ts',
        // Composition roots and CLI entry points: wiring only, exercised manually and by E2E.
        'apps/*/src/container.ts',
        'apps/worker/src/migrate.ts',
        'apps/worker/src/stripe-setup.ts',
        // React pages and components: covered by the Playwright journeys.
        'apps/web/src/app/**',
        'apps/web/src/components/**',
        'apps/web/e2e/**',
      ],
      reporter: ['text-summary', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        'packages/domain/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'packages/agents/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
        // Step 2 gate: state machines and grade/attendance calculations are fully covered.
        'packages/domain/src/{submissions,attendance,billing}/**': full,
        'packages/domain/src/shared/state-machine.ts': full,
        'packages/domain/src/gradebook/{grade-calculations,gpa}.ts': full,
      },
    },
  },
});
