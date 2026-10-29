import { sql, type Kysely } from 'kysely';
import type { UserId } from '@thp/domain';
import type { PasswordCredential, PasswordCredentialRepository } from '@thp/ports';
import type { Database } from '../schema.ts';

export class PostgresPasswordCredentialRepository implements PasswordCredentialRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByUserId(userId: UserId): Promise<PasswordCredential | null> {
    const row = await this.db
      .selectFrom('password_credentials')
      .select(['user_id', 'password_hash'])
      .where('user_id', '=', userId)
      .executeTakeFirst();
    return row === undefined
      ? null
      : { userId: row.user_id as UserId, passwordHash: row.password_hash };
  }

  async save(credential: PasswordCredential): Promise<void> {
    await this.db
      .insertInto('password_credentials')
      .values({ user_id: credential.userId, password_hash: credential.passwordHash })
      .onConflict((conflict) =>
        conflict
          .column('user_id')
          .doUpdateSet({ password_hash: credential.passwordHash, updated_at: sql<Date>`now()` }),
      )
      .execute();
  }
}
