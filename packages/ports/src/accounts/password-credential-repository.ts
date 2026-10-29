import type { UserId } from '@thp/domain';

export interface PasswordCredential {
  readonly userId: UserId;
  readonly passwordHash: string;
}

/**
 * Password hashes, kept apart from users so a hash can never travel with a User to the UI.
 * Users who sign in only with Google have none.
 */
export interface PasswordCredentialRepository {
  findByUserId(userId: UserId): Promise<PasswordCredential | null>;
  save(credential: PasswordCredential): Promise<void>;
}
