import type { Kysely } from 'kysely';
import type { AssignmentId, Grade, GradeId, SchoolId, StudentId } from '@thp/domain';
import type { GradeRepository } from '@thp/ports';
import { gradeMapper } from '../mappers/gradebook-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

/** One grade per student and assignment: saving another replaces it (enforced by a unique key too). */
export class PostgresGradeRepository implements GradeRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: GradeId): Promise<Grade | null> {
    const row = await this.db
      .selectFrom('grades')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : gradeMapper.fromRow(row);
  }

  async save(grade: Grade): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('grades')
        .where('student_id', '=', grade.studentId)
        .where('assignment_id', '=', grade.assignmentId)
        .where('id', '<>', grade.id)
        .execute();
      await upsert(trx, 'grades', gradeMapper.toRow(grade));
    });
  }

  async findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Grade | null> {
    const row = await this.db
      .selectFrom('grades')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('student_id', '=', studentId)
      .where('assignment_id', '=', assignmentId)
      .executeTakeFirst();
    return row === undefined ? null : gradeMapper.fromRow(row);
  }

  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly Grade[]> {
    return this.list(schoolId, 'student_id', studentId);
  }

  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Grade[]> {
    return this.list(schoolId, 'assignment_id', assignmentId);
  }

  async listByAssignments(
    schoolId: SchoolId,
    assignmentIds: readonly AssignmentId[],
  ): Promise<readonly Grade[]> {
    if (assignmentIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('grades')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('assignment_id', 'in', assignmentIds)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(gradeMapper.fromRow);
  }

  async deleteByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<void> {
    await this.db
      .deleteFrom('grades')
      .where('school_id', '=', schoolId)
      .where('assignment_id', '=', assignmentId)
      .execute();
  }

  private async list(
    schoolId: SchoolId,
    column: 'student_id' | 'assignment_id',
    value: string,
  ): Promise<readonly Grade[]> {
    const rows = await this.db
      .selectFrom('grades')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where(column, '=', value)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(gradeMapper.fromRow);
  }
}
