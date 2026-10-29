import type { Kysely } from 'kysely';
import type { ClassId, GradeCategory, GradeCategoryId, SchoolId } from '@thp/domain';
import type { GradeCategoryRepository } from '@thp/ports';
import { gradeCategoryMapper } from '../mappers/gradebook-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresGradeCategoryRepository implements GradeCategoryRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: GradeCategoryId): Promise<GradeCategory | null> {
    const row = await this.db
      .selectFrom('grade_categories')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : gradeCategoryMapper.fromRow(row);
  }

  save(gradeCategory: GradeCategory): Promise<void> {
    return upsert(this.db, 'grade_categories', gradeCategoryMapper.toRow(gradeCategory));
  }

  async delete(schoolId: SchoolId, id: GradeCategoryId): Promise<void> {
    await this.db
      .deleteFrom('grade_categories')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly GradeCategory[]> {
    const rows = await this.db
      .selectFrom('grade_categories')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(gradeCategoryMapper.fromRow);
  }
}
