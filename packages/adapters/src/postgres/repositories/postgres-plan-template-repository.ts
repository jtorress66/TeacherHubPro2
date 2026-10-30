import type { Kysely } from 'kysely';
import type { PlanTemplate, PlanTemplateId, SchoolId, UserId } from '@thp/domain';
import type { PlanTemplateRepository } from '@thp/ports';
import { planTemplateMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresPlanTemplateRepository implements PlanTemplateRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: PlanTemplateId): Promise<PlanTemplate | null> {
    const row = await this.db
      .selectFrom('plan_templates')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : planTemplateMapper.fromRow(row);
  }

  save(entity: PlanTemplate): Promise<void> {
    return upsert(this.db, 'plan_templates', planTemplateMapper.toRow(entity));
  }

  async delete(schoolId: SchoolId, id: PlanTemplateId): Promise<void> {
    await this.db
      .deleteFrom('plan_templates')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly PlanTemplate[]> {
    const rows = await this.db
      .selectFrom('plan_templates')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(planTemplateMapper.fromRow);
  }
}
