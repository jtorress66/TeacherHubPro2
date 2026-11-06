/** What happened to one old collection during an import. Counts and reasons only: no personal data. */
export interface CollectionReport {
  readonly collection: string;
  readonly read: number;
  readonly imported: number;
  /** Records left out, by reason. */
  readonly skipped: Readonly<Record<string, number>>;
  /** Records imported with a change worth knowing (a dropped field, a moved date), by note. */
  readonly notes: Readonly<Record<string, number>>;
}

export interface MigrationReport {
  readonly collections: readonly CollectionReport[];
  /** Collections where read ≠ imported + skipped: every record must be accounted for. */
  readonly unaccounted: readonly string[];
}

interface Counts {
  read: number;
  imported: number;
  skipped: Record<string, number>;
  notes: Record<string, number>;
}

const bump = (counts: Record<string, number>, key: string, by = 1) => {
  counts[key] = (counts[key] ?? 0) + by;
};

const sum = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((total, count) => total + count, 0);

/** Keeps the import's counts as it runs, in the order collections are first seen. */
export class MigrationTally {
  private readonly counts = new Map<string, Counts>();

  read(collection: string, count: number): void {
    this.of(collection).read += count;
  }

  imported(collection: string, count = 1): void {
    this.of(collection).imported += count;
  }

  skipped(collection: string, reason: string): void {
    bump(this.of(collection).skipped, reason);
  }

  noted(collection: string, note: string): void {
    bump(this.of(collection).notes, note);
  }

  /** A whole collection that is not carried over (transient data, or no counterpart). */
  leftOut(collection: string, count: number, reason: string): void {
    const counts = this.of(collection);
    counts.read += count;
    bump(counts.skipped, reason, count);
  }

  report(): MigrationReport {
    const collections = [...this.counts].map(([collection, counts]) => ({
      collection,
      read: counts.read,
      imported: counts.imported,
      skipped: { ...counts.skipped },
      notes: { ...counts.notes },
    }));
    return {
      collections,
      unaccounted: collections
        .filter((c) => c.read !== c.imported + sum(c.skipped))
        .map((c) => c.collection),
    };
  }

  private of(collection: string): Counts {
    let counts = this.counts.get(collection);
    if (counts === undefined) {
      counts = { read: 0, imported: 0, skipped: {}, notes: {} };
      this.counts.set(collection, counts);
    }
    return counts;
  }
}

const listed = (counts: Readonly<Record<string, number>>): string =>
  Object.entries(counts)
    .map(([key, count]) => `${key} ${String(count)}`)
    .join(', ');

/** The report as plain lines for the terminal. */
export function formatReport(report: MigrationReport): string[] {
  const lines = report.collections.flatMap((c) => [
    `${c.collection}: read ${String(c.read)}, imported ${String(c.imported)}, skipped ${String(sum(c.skipped))}`,
    ...(sum(c.skipped) > 0 ? [`  skipped: ${listed(c.skipped)}`] : []),
    ...(sum(c.notes) > 0 ? [`  note: ${listed(c.notes)}`] : []),
  ]);
  if (report.unaccounted.length > 0) {
    lines.push(`Counts do not add up for: ${report.unaccounted.join(', ')}`);
  }
  return lines;
}
