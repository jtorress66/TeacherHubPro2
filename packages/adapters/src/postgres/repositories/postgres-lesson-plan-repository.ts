import type { Kysely } from 'kysely';
import type { LessonPlan, LessonPlanId, PlanFolderId, SchoolId, UserId } from '@thp/domain';
import type { LessonPlanRepository } from '@thp/ports';
import { lessonPlanMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresLessonPlanRepository implements LessonPlanRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: LessonPlanId): Promise<LessonPlan | null> {
    const row = await this.db
      .selectFrom('lesson_plans')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : lessonPlanMapper.fromRow(row);
  }

  save(lessonPlan: LessonPlan): Promise<void> {
    return upsert(this.db, 'lesson_plans', lessonPlanMapper.toRow(lessonPlan));
  }

  async delete(schoolId: SchoolId, id: LessonPlanId): Promise<void> {
    await this.db
      .deleteFrom('lesson_plans')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LessonPlan[]> {
    const rows = await this.db
      .selectFrom('lesson_plans')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(lessonPlanMapper.fromRow);
  }

  async unfileFolder(schoolId: SchoolId, folderId: PlanFolderId): Promise<void> {
    await this.db
      .updateTable('lesson_plans')
      .set({ folder_id: null })
      .where('school_id', '=', schoolId)
      .where('folder_id', '=', folderId)
      .execute();
  }
}
