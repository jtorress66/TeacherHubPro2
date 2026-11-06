/** One record from the old app's database, as exported. */
export type LegacyDocument = Readonly<Record<string, unknown>>;

/** The old app's data, read one collection at a time for the import. */
export interface LegacySource {
  /** Every record of an old collection; none when the collection was not exported. */
  read(collection: string): Promise<readonly LegacyDocument[]>;
}
