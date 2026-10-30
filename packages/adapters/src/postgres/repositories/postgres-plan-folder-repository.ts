import type { Kysely } from 'kysely';
import type { PlanFolder, PlanFolderId, SchoolId, UserId } from '@thp/domain';
import type { PlanFolderRepository } from '@thp/ports';
import { planFolderMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresPlanFolderRepository implements PlanFolderRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: PlanFolderId): Promise<PlanFolder | null> {
    const row = await this.db
      .selectFrom('plan_folders')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : planFolderMapper.fromRow(row);
  }

  save(entity: PlanFolder): Promise<void> {
    return upsert(this.db, 'plan_folders', planFolderMapper.toRow(entity));
  }

  async delete(schoolId: SchoolId, id: PlanFolderId): Promise<void> {
    await this.db
      .deleteFrom('plan_folders')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanFolder[]> {
    const rows = await this.db
      .selectFrom('plan_folders')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(planFolderMapper.fromRow);
  }
}
