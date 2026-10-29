import type { Kysely, Selectable, SelectQueryBuilder } from 'kysely';
import type { Class, ClassId, SchoolId, SemesterId, UserId } from '@thp/domain';
import type { ClassListOptions, ClassRepository } from '@thp/ports';
import { classMapper } from '../mappers/school-mappers.ts';
import type { ClassesTable, Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

type ClassQuery = SelectQueryBuilder<Database, 'classes', Selectable<ClassesTable>>;

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

  listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    options: ClassListOptions = {},
  ): Promise<readonly Class[]> {
    return this.list(schoolId, options, (query) => query.where('teacher_id', '=', teacherId));
  }

  listBySchool(schoolId: SchoolId, options: ClassListOptions = {}): Promise<readonly Class[]> {
    return this.list(schoolId, options, (query) => query);
  }

  async countBySemester(schoolId: SchoolId, semesterId: SemesterId): Promise<number> {
    const { count } = await this.db
      .selectFrom('classes')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('school_id', '=', schoolId)
      .where('semester_id', '=', semesterId)
      .executeTakeFirstOrThrow();
    return Number(count);
  }

  private async list(
    schoolId: SchoolId,
    options: ClassListOptions,
    narrow: (query: ClassQuery) => ClassQuery,
  ): Promise<readonly Class[]> {
    let query = narrow(this.db.selectFrom('classes').selectAll().where('school_id', '=', schoolId));
    if (options.includeArchived !== true) query = query.where('archived_at', 'is', null);
    const rows = await query.orderBy('created_at').orderBy('id').execute();
    return rows.map(classMapper.fromRow);
  }
}
