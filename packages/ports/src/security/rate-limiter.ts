/** Counts attempts per key in fixed time windows. */
export interface RateLimiter {
  /** Records one attempt at `at`; true while the key has used no more than `limit` in its window. */
  hit(input: {
    readonly key: string;
    readonly limit: number;
    readonly windowMs: number;
    readonly at: Date;
  }): Promise<boolean>;
}
