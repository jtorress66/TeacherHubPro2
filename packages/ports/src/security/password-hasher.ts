export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  /** True for hashes made with an older scheme (e.g. migrated accounts) that should be rehashed after login. */
  needsRehash(hash: string): boolean;
}
