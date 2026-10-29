import { posix } from 'node:path';

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export interface ImportViolation {
  readonly path: string;
  readonly specifier: string;
  readonly rule: 'layer' | 'sdk';
}

/** Workspace packages each package may import (CLAUDE.md, "Architecture"). */
export const allowedWorkspaceDeps: Readonly<Record<string, readonly string[]>> = {
  domain: [],
  ports: ['domain'],
  application: ['domain', 'ports'],
  agents: ['domain', 'ports'],
  adapters: ['domain', 'ports'],
  testing: ['domain', 'ports'],
  i18n: [],
};

/** Packages whose tests may also import the testing package. */
const testsMayUseTesting = new Set(['application', 'agents', 'adapters']);

/** SDKs and drivers that only adapters and composition roots may import. */
export const sdkModules: readonly string[] = [
  'pg',
  'kysely',
  'stripe',
  '@anthropic-ai/sdk',
  'openai',
  'resend',
  'googleapis',
  'google-auth-library',
];

const importPattern =
  /(?:^|[\s;])(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

export function importsOf(source: string): string[] {
  return [...source.matchAll(importPattern)].flatMap((match) => {
    const specifier = match[1] ?? match[2];
    return specifier === undefined ? [] : [specifier];
  });
}

/** Test files, and support files in a package's `test/` folder (global setup, database helpers). */
const isTestFile = (path: string): boolean =>
  /\.test\.tsx?$/.test(path) || /^packages\/[^/]+\/test\//.test(path);

const mayImportSdks = (path: string): boolean =>
  path.startsWith('packages/adapters/') || /^apps\/[^/]+\/src\/container\.ts$/.test(path);

const isSdk = (specifier: string): boolean =>
  sdkModules.some((sdk) => specifier === sdk || specifier.startsWith(`${sdk}/`));

function packageOf(path: string): string | undefined {
  return /^packages\/([^/]+)\//.exec(path)?.[1];
}

function breaksLayer(path: string, pkg: string, specifier: string): boolean {
  if (specifier.startsWith('.')) {
    const target = posix.normalize(posix.join(posix.dirname(path), specifier));
    return !target.startsWith(`packages/${pkg}/`);
  }
  const workspace = /^@thp\/([^/]+)/.exec(specifier)?.[1];
  if (workspace === undefined) return false;
  const allowed = allowedWorkspaceDeps[pkg] ?? [];
  if (allowed.includes(workspace)) return false;
  return !(workspace === 'testing' && isTestFile(path) && testsMayUseTesting.has(pkg));
}

export function findImportViolations(files: readonly SourceFile[]): ImportViolation[] {
  return files.flatMap(({ path, source }) => {
    const pkg = packageOf(path);
    return importsOf(source).flatMap((specifier): ImportViolation[] => {
      if (isSdk(specifier) && !mayImportSdks(path)) return [{ path, specifier, rule: 'sdk' }];
      if (pkg !== undefined && breaksLayer(path, pkg, specifier)) {
        return [{ path, specifier, rule: 'layer' }];
      }
      return [];
    });
  });
}
