import type { Kysely } from 'kysely';
import type { Assignment, AssignmentId, ClassId, SchoolId } from '@thp/domain';
import type { AssignmentRepository } from '@thp/ports';
import { assignmentMapper } from '../mappers/gradebook-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: AssignmentId): Promise<Assignment | null> {
    const row = await this.db
      .selectFrom('assignments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : assignmentMapper.fromRow(row);
  }

  save(assignment: Assignment): Promise<void> {
    return upsert(this.db, 'assignments', assignmentMapper.toRow(assignment));
  }

  async delete(schoolId: SchoolId, id: AssignmentId): Promise<void> {
    await this.db
      .deleteFrom('assignments')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Assignment[]> {
    const rows = await this.db
      .selectFrom('assignments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(assignmentMapper.fromRow);
  }
}
