import type { Kysely } from 'kysely';
import {
  emailDomain,
  isWithinDomain,
  roles,
  type PasswordToken,
  type PasswordTokenId,
  type Role,
  type School,
  type SchoolId,
  type User,
  type UserId,
} from '@thp/domain';
import type {
  PasswordTokenRepository,
  PlatformCounts,
  PlatformStats,
  SchoolDirectory,
  UserDirectory,
  UserSearch,
} from '@thp/ports';
import { schoolMapper, userMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';

/** Postgres refuses a delete that rows elsewhere still reference with this code. */
const isStillReferenced = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503';

/** A teacher's own work, which goes with them; nothing here belongs to a class or student. */
const ownWork = [
  'lesson_plans',
  'plan_templates',
  'plan_folders',
  'ai_generations',
  'presentations',
] as const;

export class PostgresSchoolDirectory implements SchoolDirectory {
  constructor(private readonly db: Kysely<Database>) {}

  async listAll(): Promise<readonly School[]> {
    const rows = await this.db
      .selectFrom('schools')
      .selectAll()
      .orderBy('name')
      .orderBy('id')
      .execute();
    return rows.map(schoolMapper.fromRow);
  }

  async delete(id: SchoolId): Promise<'deleted' | 'in_use' | 'not_found'> {
    try {
      const result = await this.db.deleteFrom('schools').where('id', '=', id).executeTakeFirst();
      return result.numDeletedRows > 0n ? 'deleted' : 'not_found';
    } catch (error) {
      if (isStillReferenced(error)) return 'in_use';
      throw error;
    }
  }
}

export class PostgresUserDirectory implements UserDirectory {
  constructor(private readonly db: Kysely<Database>) {}

  async search(query: UserSearch): Promise<readonly User[]> {
    let select = this.db.selectFrom('users').selectAll();
    if (query.schoolId !== undefined) select = select.where('school_id', '=', query.schoolId);
    const text = query.text?.trim() ?? '';
    if (text !== '') {
      const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      select = select.where((eb) =>
        eb.or([eb('name', 'ilike', pattern), eb('email', 'ilike', pattern)]),
      );
    }
    const rows = await select
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.limit)
      .execute();
    return rows.map(userMapper.fromRow);
  }

  async listByEmailDomain(domain: string): Promise<readonly User[]> {
    const parent = domain.toLowerCase();
    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .where((eb) =>
        eb.or([eb('email', 'like', `%@${parent}`), eb('email', 'like', `%.${parent}`)]),
      )
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows
      .map(userMapper.fromRow)
      .filter((user) => isWithinDomain(emailDomain(user.email), parent));
  }

  async countByRole(role: Role): Promise<number> {
    const row = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('role', '=', role)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async delete(id: UserId): Promise<'deleted' | 'in_use' | 'not_found'> {
    try {
      return await this.db.transaction().execute(async (trx) => {
        await trx.deleteFrom('jobs').where('owner_id', '=', id).execute();
        for (const table of ownWork) {
          await trx.deleteFrom(table).where('teacher_id', '=', id).execute();
        }
        const result = await trx.deleteFrom('users').where('id', '=', id).executeTakeFirst();
        return result.numDeletedRows > 0n ? 'deleted' : 'not_found';
      });
    } catch (error) {
      if (isStillReferenced(error)) return 'in_use';
      throw error;
    }
  }

  async moveToSchool(id: UserId, schoolId: SchoolId): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.updateTable('users').set({ school_id: schoolId }).where('id', '=', id).execute();
      await trx
        .updateTable('lesson_plans')
        .set({ school_id: schoolId, class_id: null })
        .where('teacher_id', '=', id)
        .execute();
      for (const table of [
        'plan_templates',
        'plan_folders',
        'ai_generations',
        'presentations',
      ] as const) {
        await trx
          .updateTable(table)
          .set({ school_id: schoolId })
          .where('teacher_id', '=', id)
          .execute();
      }
      await trx.deleteFrom('jobs').where('owner_id', '=', id).execute();
    });
  }
}

export class PostgresPlatformStats implements PlatformStats {
  constructor(private readonly db: Kysely<Database>) {}

  private async total(table: 'schools' | 'classes' | 'students' | 'lesson_plans'): Promise<number> {
    const row = await this.db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  private async bySchool(table: 'users' | 'classes' | 'students'): Promise<Map<string, number>> {
    const rows = await this.db
      .selectFrom(table)
      .select(['school_id', (eb) => eb.fn.countAll<string>().as('count')])
      .groupBy('school_id')
      .execute();
    return new Map(rows.map((row) => [row.school_id, Number(row.count)]));
  }

  async counts(): Promise<PlatformCounts> {
    const byRole = await this.db
      .selectFrom('users')
      .select(['role', (eb) => eb.fn.countAll<string>().as('count')])
      .groupBy('role')
      .execute();
    const roleCount = new Map(byRole.map((row) => [row.role, Number(row.count)]));
    const [users, classes, students] = await Promise.all([
      this.bySchool('users'),
      this.bySchool('classes'),
      this.bySchool('students'),
    ]);
    const schools = await this.db.selectFrom('schools').select('id').orderBy('name').execute();
    return {
      schools: await this.total('schools'),
      users: Object.fromEntries(roles.map((role) => [role, roleCount.get(role) ?? 0])) as Record<
        Role,
        number
      >,
      classes: await this.total('classes'),
      students: await this.total('students'),
      lessonPlans: await this.total('lesson_plans'),
      perSchool: schools.map(({ id }) => ({
        schoolId: id as SchoolId,
        users: users.get(id) ?? 0,
        classes: classes.get(id) ?? 0,
        students: students.get(id) ?? 0,
      })),
    };
  }
}

export class PostgresPasswordTokenRepository implements PasswordTokenRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async save(token: PasswordToken): Promise<void> {
    const row = {
      id: token.id,
      user_id: token.userId,
      school_id: token.schoolId,
      token_hash: token.tokenHash,
      purpose: token.purpose,
      issued_at: token.createdAt,
      expires_at: token.expiresAt,
      used_at: token.usedAt,
    };
    await this.db
      .insertInto('password_tokens')
      .values(row)
      .onConflict((conflict) => conflict.column('id').doUpdateSet(row))
      .execute();
  }

  async findByHash(tokenHash: string): Promise<PasswordToken | null> {
    const row = await this.db
      .selectFrom('password_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    if (row === undefined) return null;
    return {
      id: row.id as PasswordTokenId,
      userId: row.user_id as UserId,
      schoolId: row.school_id as SchoolId,
      tokenHash: row.token_hash,
      purpose: row.purpose === 'reset' ? 'reset' : 'welcome',
      createdAt: row.issued_at,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
    };
  }

  async revokeFor(userId: UserId, now: Date): Promise<void> {
    await this.db
      .updateTable('password_tokens')
      .set({ used_at: now })
      .where('user_id', '=', userId)
      .where('used_at', 'is', null)
      .execute();
  }
}
