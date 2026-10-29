import type { Kysely } from 'kysely';
import type { ClassId, SchoolId, Student, StudentId } from '@thp/domain';
import type { StudentRepository } from '@thp/ports';
import { studentMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresStudentRepository implements StudentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: StudentId): Promise<Student | null> {
    const row = await this.db
      .selectFrom('students')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : studentMapper.fromRow(row);
  }

  save(student: Student): Promise<void> {
    return upsert(this.db, 'students', studentMapper.toRow(student));
  }

  /** One transaction: a repeated student number (unique per class) rolls back the whole batch. */
  async saveMany(students: readonly Student[]): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const student of students) await upsert(trx, 'students', studentMapper.toRow(student));
    });
  }

  async delete(schoolId: SchoolId, id: StudentId): Promise<void> {
    await this.db
      .deleteFrom('students')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]> {
    const rows = await this.db
      .selectFrom('students')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(studentMapper.fromRow);
  }
}
