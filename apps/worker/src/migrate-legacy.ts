import { fileURLToPath } from 'node:url';
import { formatReport } from '@thp/domain';
import { parseDatabaseConfig } from './config.ts';
import { importLegacyData } from './container.ts';
import { parseLegacyArgs } from './legacy-args.ts';

/**
 * CLI: `pnpm migrate:legacy --from <export folder> [--apply]`. Prints counts and reasons only,
 * never names or contact details. Without --apply nothing is written.
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const args = parseLegacyArgs(process.argv.slice(2), repoRoot);
const database = parseDatabaseConfig(process.env);
if (!args.ok || !database.ok) {
  process.stderr.write(`${args.ok ? (database.ok ? '' : database.error) : args.error}\n`);
  process.exit(1);
}

const report = await importLegacyData(database.value, args.value.folder, args.value.apply);
process.stdout.write(`${formatReport(report).join('\n')}\n`);
process.stdout.write(
  args.value.apply
    ? 'Imported. Running it again updates the same records.\n'
    : 'Dry run: nothing was written. Add --apply to import.\n',
);
if (report.unaccounted.length > 0) process.exit(1);
