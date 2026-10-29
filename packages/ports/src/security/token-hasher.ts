/** One-way hash for link tokens; only the hash is stored, and lookups hash the presented token. */
export interface TokenHasher {
  hash(token: string): Promise<string>;
}
