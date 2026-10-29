import type { Kysely } from 'kysely';
import type { Class, ClassId, SchoolId, UserId } from '@thp/domain';
import type { ClassRepository } from '@thp/ports';
import { classMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresClassRepository implements ClassRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: ClassId): Promise<Class | null> {
    const row = await this.db
      .selectFrom('classes')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : classMapper.fromRow(row);
  }

  save(cls: Class): Promise<void> {
    return upsert(this.db, 'classes', classMapper.toRow(cls));
  }

  async delete(schoolId: SchoolId, id: ClassId): Promise<void> {
    await this.db
      .deleteFrom('classes')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Class[]> {
    const rows = await this.db
      .selectFrom('classes')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(classMapper.fromRow);
  }
}
