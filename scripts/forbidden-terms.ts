import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export interface TrackedFile {
  readonly path: string;
  readonly content: string;
}

export interface Violation {
  readonly path: string;
  readonly line: number;
}

// The character class keeps this file from matching its own pattern.
const forbidden = /emerg[e]nt/i;

const isAllowed = (path: string): boolean => path === 'CLAUDE.md' || path.startsWith('docs/');

export function findForbiddenTerms(files: readonly TrackedFile[]): Violation[] {
  return files
    .filter((file) => !isAllowed(file.path))
    .flatMap((file) =>
      file.content
        .split('\n')
        .flatMap((text, index) =>
          forbidden.test(text) ? [{ path: file.path, line: index + 1 }] : [],
        ),
    );
}

function trackedFiles(): TrackedFile[] {
  const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  return paths.map((path) => ({ path, content: readFileSync(path, 'utf8') }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const violations = findForbiddenTerms(trackedFiles());
  for (const { path, line } of violations) console.error(`${path}:${String(line)}`);
  if (violations.length > 0) {
    console.error(
      'Forbidden legacy-platform references found (allowed only in CLAUDE.md and docs/).',
    );
    process.exit(1);
  }
  console.log('No forbidden references found.');
}
