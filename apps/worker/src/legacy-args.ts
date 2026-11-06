import { posix, win32 } from 'node:path';
import { err, ok, type Result } from '@thp/domain';

export interface LegacyArgs {
  /** The folder of `mongoexport` files. */
  readonly folder: string;
  /** Write to the database; without it the import is a dry run. */
  readonly apply: boolean;
}

const usage = 'Usage: pnpm migrate:legacy --from <export folder> [--apply]';
const insideRepo =
  'Keep the export outside the repository (it holds student data), e.g. C:\\thp-export.';

/** `--from <folder> [--apply]`. The folder must be outside the repository: it holds student data. */
export function parseLegacyArgs(
  argv: readonly string[],
  repoRoot: string,
): Result<LegacyArgs, string> {
  const at = argv.indexOf('--from');
  const folder = at >= 0 ? argv[at + 1] : undefined;
  if (folder === undefined || folder.startsWith('--')) return err(usage);
  const paths = /^[a-z]:[\\/]/iu.test(repoRoot) ? win32 : posix;
  const relative = paths.relative(paths.resolve(repoRoot), paths.resolve(folder));
  if (!relative.startsWith('..') && !paths.isAbsolute(relative)) return err(insideRepo);
  return ok({ folder, apply: argv.includes('--apply') });
}
