import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LegacyDocument, LegacySource } from '@thp/ports';

const numberTypes = ['$numberInt', '$numberLong', '$numberDouble', '$numberDecimal'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function dateOf(value: unknown): string {
  const time = isRecord(value) ? Number(value.$numberLong) : value;
  return new Date(time as string | number).toISOString();
}

/** Mongo's Extended JSON ({"$oid": …}, {"$date": …}, {"$numberLong": …}) as plain values. */
function plain(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plain);
  if (!isRecord(value)) return value;
  if (typeof value.$oid === 'string') return value.$oid;
  if ('$date' in value) return dateOf(value.$date);
  for (const type of numberTypes) {
    if (typeof value[type] === 'string') return Number(value[type]);
  }
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plain(inner)]));
}

/** One record per line (mongoexport's default), a `--jsonArray` file, or a single document. */
function parse(content: string): unknown[] {
  const text = content.trim();
  if (text === '') return [];
  try {
    const whole: unknown = JSON.parse(text);
    return Array.isArray(whole) ? whole : [whole];
  } catch {
    return text
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as unknown);
  }
}

/**
 * Reads `<folder>/<collection>.json` as written by `mongoexport`, one record per line or with
 * `--jsonArray`. The folder holds student data, so it is never part of the repository.
 */
export class MongoExportSource implements LegacySource {
  constructor(private readonly folder: string) {}

  async read(collection: string): Promise<readonly LegacyDocument[]> {
    if (!/^[a-z_]+$/u.test(collection))
      throw new Error(`Unexpected collection name: ${collection}`);
    let content: string;
    try {
      content = await readFile(join(this.folder, `${collection}.json`), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return parse(content).map(plain).filter(isRecord);
  }
}
