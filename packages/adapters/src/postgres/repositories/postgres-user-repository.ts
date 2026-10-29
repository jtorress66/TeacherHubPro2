import type { Kysely } from 'kysely';
import type { Email, SchoolId, User, UserId } from '@thp/domain';
import type { UserRepository } from '@thp/ports';
import { userMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: UserId): Promise<User | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : userMapper.fromRow(row);
  }

  save(user: User): Promise<void> {
    return upsert(this.db, 'users', userMapper.toRow(user));
  }

  async listBySchool(schoolId: SchoolId): Promise<readonly User[]> {
    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(userMapper.fromRow);
  }

  /** Unscoped on purpose: sign-in finds a user by email before the school is known. */
  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();
    return row === undefined ? null : userMapper.fromRow(row);
  }
}
