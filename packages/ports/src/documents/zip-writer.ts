/** One text file inside a ZIP archive. */
export interface ZipEntry {
  readonly name: string;
  readonly text: string;
}

/** Packs text files into one ZIP archive. */
export interface ZipWriter {
  zip(entries: readonly ZipEntry[]): Promise<Uint8Array>;
}
