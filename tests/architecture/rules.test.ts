import { describe, expect, it } from 'vitest';
import { findImportViolations, importsOf } from './rules.ts';

describe('importsOf', () => {
  it('finds static, side-effect, re-export and dynamic imports', () => {
    const source = [
      "import { a } from '@thp/domain';",
      "import type { B } from '@thp/ports';",
      "import 'side-effect';",
      "export * from './local.ts';",
      "const c = await import('openai');",
    ].join('\n');

    expect(importsOf(source)).toEqual([
      '@thp/domain',
      '@thp/ports',
      'side-effect',
      './local.ts',
      'openai',
    ]);
  });
});

describe('findImportViolations', () => {
  it('flags domain importing another workspace package', () => {
    const violations = findImportViolations([
      { path: 'packages/domain/src/a.ts', source: "import { x } from '@thp/adapters';" },
    ]);

    expect(violations).toEqual([
      { path: 'packages/domain/src/a.ts', specifier: '@thp/adapters', rule: 'layer' },
    ]);
  });

  it('lets application import domain and ports only', () => {
    const violations = findImportViolations([
      {
        path: 'packages/application/src/ok.ts',
        source: "import '@thp/domain'; import '@thp/ports';",
      },
      { path: 'packages/application/src/bad.ts', source: "import '@thp/agents';" },
    ]);

    expect(violations.map((v) => v.path)).toEqual(['packages/application/src/bad.ts']);
  });

  it('lets tests of application, agents and adapters use the testing package', () => {
    const violations = findImportViolations([
      { path: 'packages/agents/src/x.test.ts', source: "import '@thp/testing';" },
      { path: 'packages/agents/src/x.ts', source: "import '@thp/testing';" },
    ]);

    expect(violations.map((v) => v.path)).toEqual(['packages/agents/src/x.ts']);
  });

  it('treats support files in a package test folder like tests', () => {
    const violations = findImportViolations([
      { path: 'packages/adapters/test/postgres/test-db.ts', source: "import '@thp/testing';" },
      { path: 'packages/domain/test/helpers.ts', source: "import '@thp/testing';" },
    ]);

    expect(violations.map((v) => v.path)).toEqual(['packages/domain/test/helpers.ts']);
  });

  it('flags SDK and driver imports outside adapters and composition roots', () => {
    const violations = findImportViolations([
      { path: 'packages/agents/src/a.ts', source: "import Anthropic from '@anthropic-ai/sdk';" },
      { path: 'apps/web/src/page.tsx', source: "import { Pool } from 'pg';" },
      {
        path: 'packages/adapters/src/claude.ts',
        source: "import Anthropic from '@anthropic-ai/sdk';",
      },
      { path: 'apps/worker/src/container.ts', source: "import { Kysely } from 'kysely';" },
    ]);

    expect(violations).toEqual([
      { path: 'packages/agents/src/a.ts', specifier: '@anthropic-ai/sdk', rule: 'sdk' },
      { path: 'apps/web/src/page.tsx', specifier: 'pg', rule: 'sdk' },
    ]);
  });

  it('flags deep imports of SDK subpaths', () => {
    const violations = findImportViolations([
      { path: 'packages/domain/src/a.ts', source: "import x from 'openai/resources';" },
    ]);

    expect(violations).toEqual([
      { path: 'packages/domain/src/a.ts', specifier: 'openai/resources', rule: 'sdk' },
    ]);
  });

  it('flags relative imports that reach into another package', () => {
    const violations = findImportViolations([
      { path: 'packages/domain/src/a.ts', source: "import '../../adapters/src/x.ts';" },
      { path: 'packages/domain/src/b/c.ts', source: "import '../a.ts';" },
    ]);

    expect(violations).toEqual([
      { path: 'packages/domain/src/a.ts', specifier: '../../adapters/src/x.ts', rule: 'layer' },
    ]);
  });

  it('keeps i18n free of other workspace packages', () => {
    const violations = findImportViolations([
      { path: 'packages/i18n/src/a.ts', source: "import '@thp/domain';" },
    ]);

    expect(violations).toHaveLength(1);
  });
});
