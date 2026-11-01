/** Seeds for game rounds: each play gets a fresh one, so play-again reshuffles. */
export interface SeedSource {
  /** A whole number in [0, 2^31). */
  next(): number;
}
