import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allowedWorkspaceDeps,
  findImportViolations,
  type SourceFile,
} from './architecture/rules.ts';

const root = join(import.meta.dirname, '..');

function sourceFiles(dir: string): SourceFile[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|mts)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !/[\\/](node_modules|\.next)[\\/]/.test(path))
    .map((path) => ({
      path: relative(root, path).replaceAll('\\', '/'),
      source: readFileSync(path, 'utf8'),
    }));
}

const packageDirs = readdirSync(join(root, 'packages'));

describe('architecture', () => {
  it('every package has a layer rule', () => {
    expect(packageDirs.filter((name) => !(name in allowedWorkspaceDeps))).toEqual([]);
  });

  it('package.json files declare only the workspace dependencies their layer allows', () => {
    for (const name of packageDirs) {
      const manifest = JSON.parse(
        readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };
      const workspaceDeps = Object.keys(manifest.dependencies ?? {})
        .filter((dep) => dep.startsWith('@thp/'))
        .map((dep) => dep.slice('@thp/'.length));
      const allowed = allowedWorkspaceDeps[name] ?? [];

      expect(
        workspaceDeps.filter((dep) => !allowed.includes(dep)),
        name,
      ).toEqual([]);
    }
  });

  it('source files follow the dependency rule and keep SDKs inside adapters', () => {
    const files = [...sourceFiles(join(root, 'packages')), ...sourceFiles(join(root, 'apps'))];

    expect(files.length).toBeGreaterThan(0);
    expect(findImportViolations(files)).toEqual([]);
  });
});
